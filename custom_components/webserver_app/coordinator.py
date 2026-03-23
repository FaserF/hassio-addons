"""Data update coordinator for the Webserver App integration."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

import aiohttp
import async_timeout
import homeassistant.util.dt as dt_util
from homeassistant.components.hassio import async_get_addon_info, is_hassio
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import CONF_ADDON_SLUG, DOMAIN

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
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=30),
        )
        self.entry = entry
        self.addon_slug = entry.data[CONF_ADDON_SLUG]

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch data from the addon and webserver."""
        if not is_hassio(self.hass):
            raise UpdateFailed("Not running on Hass.io")

        data = {}
        try:
            # 1. Fetch Addon Info
            addon_info = await async_get_addon_info(self.hass, self.addon_slug)
            if not addon_info:
                raise UpdateFailed(f"Addon {self.addon_slug} not found")

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
            certfile = options.get("certfile")
            if certfile:
                cert_path = f"/ssl/{certfile}"
                expiry = await self.hass.async_add_executor_job(get_cert_expiry, cert_path)
                if expiry:
                    data["ssl_expiry"] = expiry
                    data["ssl_days_remaining"] = (expiry - datetime.now()).days

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

        # Try Apache mod_status first (typically on port 80)
        try:
            async with async_timeout.timeout(5):
                async with aiohttp.ClientSession() as session:
                    # Apache
                    async with session.get(f"http://{hostname}/server-status?auto") as resp:
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
                            return

                    # Nginx (port 8080 as configured in nginx.sh)
                    async with session.get(f"http://{hostname}:8080/nginx_status") as resp:
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
                            return
        except Exception as err:
            _LOGGER.debug("Could not fetch webserver stats for %s: %s", self.addon_slug, err)

    async def _fetch_addon_logs(self, data: dict[str, Any]) -> None:
        """Fetch and parse addon logs for errors."""
        # We use a raw request to the Supervisor API since there's no high-level helper for logs
        try:
            # The hassio component sets up a session we can use
            if "hassio" not in self.hass.data:
                return

            hassio = self.hass.data["hassio"]
            # Supervisor API URL for logs
            url = f"http://supervisor/addons/{self.addon_slug}/logs"

            async with async_timeout.timeout(5):
                # Note: We need the Supervisor token, which is usually in the session headers or env
                # HA's Hassio component manages this.
                resp = await hassio.session.get(url)
                if resp.status == 200:
                    logs = await resp.text()
                    error_count = logs.lower().count("error")
                    warn_count = logs.lower().count("warning") + logs.lower().count("warn")
                    data["log_warnings"] = warn_count

            # 4. PHP Version (Optional)
            if data["state"] == "started":
                await self._fetch_php_version(data)

            return data
        except Exception as err:
            raise UpdateFailed(f"Error updating Webserver App data: {err}") from err

    async def _fetch_php_version(self, data: dict[str, Any]) -> None:
        """Fetch PHP version from the addon."""
        # For now, we omit this as it requires a specific endpoint in the addon.
        # But we could check if it's available in the addon_info or via a /phpversion.php file.
        pass
