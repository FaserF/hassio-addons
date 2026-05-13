"""Data update coordinator for the Webserver App integration."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import aiohttp
import async_timeout
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import CONF_ADDON_SLUG, DOMAIN
from .utils import get_supervisor_token

_LOGGER = logging.getLogger(__name__)


def get_cert_expiry(cert_path: str) -> datetime | None:
    """Get the expiry date of a certificate file."""
    try:
        from cryptography import x509
        from cryptography.hazmat.backends import default_backend

        with open(cert_path, "rb") as f:
            cert_data = f.read()
            cert = x509.load_pem_x509_certificate(cert_data, default_backend())
            return cert.not_valid_after
    except Exception as err:
        _LOGGER.debug("Error reading certificate %s: %s", cert_path, err)
        return None


class WebserverAppDataUpdateCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Class to manage fetching data from Webserver addons."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        """Initialize."""
        interval = entry.options.get("update_interval", 10)
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(minutes=interval),
        )
        self.entry = entry
        self.addon_slug = entry.data[CONF_ADDON_SLUG]

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch data from the addon and webserver."""
        token = get_supervisor_token(self.hass)
        session = async_get_clientsession(self.hass)
        headers = {"X-Supervisor-Token": token} if token else {}

        data = {}
        try:
            # 1. Fetch Addon Info via Supervisor API
            url = f"http://supervisor/addons/{self.addon_slug}/info"
            async with async_timeout.timeout(10):
                resp = await session.get(url, headers=headers)
                if resp.status == 404:
                    _LOGGER.debug(
                        "Addon %s returned 404, attempting auto-discovery of local addon slug prefix",
                        self.addon_slug,
                    )
                    list_resp = await session.get("http://supervisor/addons", headers=headers)
                    if list_resp.status == 200:
                        list_res = await list_resp.json()
                        addons = list_res.get("data", {}).get("addons", [])
                        for addon in addons:
                            s = addon.get("slug", "")
                            if s.endswith(f"_{self.addon_slug}") or s == self.addon_slug:
                                _LOGGER.info(
                                    "Auto-discovered installed slug '%s' matching target '%s'", s, self.addon_slug
                                )
                                self.addon_slug = s
                                url = f"http://supervisor/addons/{self.addon_slug}/info"
                                resp = await session.get(url, headers=headers)
                                break

                if resp.status != 200:
                    raise UpdateFailed(f"Failed to fetch addon info: {resp.status}")

                result = await resp.json()
                addon_info = result.get("data", {})

            if not addon_info:
                raise UpdateFailed(f"Addon {self.addon_slug} not found in Supervisor response")

            data.update(
                {
                    "name": addon_info.get("name"),
                    "version": addon_info.get("version"),
                    "state": addon_info.get("state"),
                    "update_available": addon_info.get("update_available"),
                    "slug": self.addon_slug,
                }
            )

            # 2. SSL Expiry Check
            options = addon_info.get("options", {})
            ssl_enabled = options.get("ssl", False)
            data["ssl_enabled"] = ssl_enabled
            if ssl_enabled:
                certfile = options.get("certfile")
                if certfile:
                    cert_path = f"/ssl/{certfile}"
                    try:
                        expiry = await self.hass.async_add_executor_job(get_cert_expiry, cert_path)
                        if expiry:
                            data["ssl_expiry"] = expiry
                            data["ssl_days_remaining"] = (expiry - datetime.now()).days
                    except Exception as err:
                        _LOGGER.debug("Could not read cert file: %s", err)

            # 3. Webserver Stats (if running)
            if data["state"] == "started":
                await self._fetch_webserver_stats(data)
                await self._fetch_addon_logs(data)

            return data
        except Exception as err:
            raise UpdateFailed(f"Error updating Webserver App data: {err}") from err

    async def _fetch_webserver_stats(self, data: dict[str, Any]) -> None:
        """Fetch stats from the webserver's status endpoint."""
        # For Apache/Nginx addons, we try to connect to localhost:80 (or 8080 for nginx stats)
        # However, from HA core, we must use the addon's hostname or IP.
        # Supervisor provides the IP in addon_info if needed, but 'slug' works as hostname usually.
        hostname = self.addon_slug.replace("_", "-")

        try:
            async with async_timeout.timeout(5):
                async with aiohttp.ClientSession() as session:
                    if "nginx" in self.addon_slug:
                        # Nginx (port 8080 as configured in nginx.sh)
                        async with session.get(f"http://{hostname}:8080/nginx_status", ssl=False) as resp:
                            if resp.status == 200:
                                text = await resp.text()
                                # Active connections: 291
                                # server accepts handled requests
                                #  16630948 16630948 31070465
                                # Reading: 6 Writing: 179 Waiting: 106
                                lines = text.splitlines()
                                data["active_connections"] = int(lines[0].split(":")[1].strip())
                                req_line = lines[2].split()
                                data["total_handled_requests"] = int(req_line[2])
                                data["webserver_type"] = "nginx"
                    else:
                        # Apache
                        urls_to_try = [
                            f"http://{hostname}/server-status?auto",
                            f"http://{hostname}:8099/server-status?auto",
                        ]
                        for url in urls_to_try:
                            try:
                                async with session.get(url, ssl=False, allow_redirects=True) as resp:
                                    if resp.status == 200:
                                        text = await resp.text()
                                        for line in text.splitlines():
                                            if line.startswith("Total Accesses:"):
                                                data["total_accesses"] = int(line.split(":")[1])
                                            elif line.startswith("CPULoad:"):
                                                data["cpu_load"] = float(line.split(":")[1])
                                            elif line.startswith("BusyWorkers:"):
                                                data["active_connections"] = int(line.split(":")[1])
                                        data["webserver_type"] = "apache"
                                        break
                            except Exception as e:
                                _LOGGER.debug("Stats fetch failed for %s: %s", url, e)
                                continue
        except Exception as err:
            _LOGGER.debug("Could not fetch webserver stats for %s: %s", self.addon_slug, err)

    async def _fetch_addon_logs(self, data: dict[str, Any]) -> None:
        """Fetch and parse addon logs for errors."""
        token = get_supervisor_token(self.hass)
        session = async_get_clientsession(self.hass)
        headers = {"X-Supervisor-Token": token} if token else {}

        try:
            # Supervisor API URL for logs
            url = f"http://supervisor/addons/{self.addon_slug}/logs"

            async with async_timeout.timeout(5):
                resp = await session.get(url, headers=headers)
                if resp.status == 200:
                    logs = await resp.text()
                    error_lines = []
                    warning_lines = []
                    for line in logs.splitlines():
                        lower_line = line.lower()
                        if "error" in lower_line:
                            error_lines.append(line)
                        elif "warning" in lower_line or "warn " in lower_line or "warn:" in lower_line:
                            warning_lines.append(line)

                    data["log_errors"] = len(error_lines)
                    data["log_errors_list"] = error_lines[-10:]  # Keep last 10
                    data["log_warnings"] = len(warning_lines)
                    data["log_warnings_list"] = warning_lines[-10:]  # Keep last 10

            # 4. PHP Version (Optional)
            if data["state"] == "started":
                await self._fetch_php_version(data)
        except Exception as err:
            _LOGGER.debug("Error fetching addon logs: %s", err)

    async def _fetch_php_version(self, data: dict[str, Any]) -> None:
        """Fetch PHP version from the addon."""
        # For now, we omit this as it requires a specific endpoint in the addon.
        # But we could check if it's available in the addon_info or via a /phpversion.php file.
        pass
