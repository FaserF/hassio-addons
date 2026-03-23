"""Config flow for the Webserver App integration."""

from __future__ import annotations

import logging
import os
from typing import Any

import async_timeout
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CONF_ADDON_SLUG,
    CONF_PORT,
    DEFAULT_PORT,
    DOMAIN,
    SUPPORTED_ADDON_SLUGS,
)
from .utils import get_supervisor_token

_LOGGER = logging.getLogger(__name__)


class WebserverAppConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Webserver App."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize the flow."""
        self._addon_slug: str | None = None
        self._port: int = DEFAULT_PORT

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        """Handle the initial step."""
        _LOGGER.error("ConfigFlow: async_step_user called")
        errors: dict[str, str] = {}

        if user_input is not None:
            # ... existing input handling ...
            self._addon_slug = user_input[CONF_ADDON_SLUG]
            self._port = user_input[CONF_PORT]
            await self.async_set_unique_id(f"{self._addon_slug}_{self._port}")
            self._abort_if_unique_id_configured()
            return self.async_create_entry(title=f"Webserver ({self._addon_slug})", data=user_input)

        # Try to detect installed addons via Supervisor API
        detected_addons = []
        _LOGGER.error("ConfigFlow: Starting detection")

        token = get_supervisor_token(self.hass)
        if not token:
            _LOGGER.error("ConfigFlow: NO SUPERVISOR_TOKEN found")

        try:
            session = async_get_clientsession(self.hass)
            headers = {"X-Supervisor-Token": token} if token else {}

            async with async_timeout.timeout(10):
                _LOGGER.error("ConfigFlow: Calling Supervisor API http://supervisor/addons")
                resp = await session.get("http://supervisor/addons", headers=headers)
                _LOGGER.error("ConfigFlow: Supervisor API status: %s", resp.status)
                if resp.status == 200:
                    result = await resp.json()
                    data_node = result.get("data", result)
                    addons = data_node.get("addons", [])

                    _LOGGER.error("ConfigFlow: Supervisor API returned %s addons", len(addons))

                    for addon in addons:
                        slug = addon.get("slug", "")
                        is_installed = addon.get("installed", False)

                        # Match if any supported slug is in the addon slug
                        # We only match if the slug ends with the supported slug (e.g. local_apache2)
                        # or if it is exactly the supported slug.
                        for supported in SUPPORTED_ADDON_SLUGS:
                            if (slug == supported or slug.endswith(f"_{supported}")) and is_installed:
                                _LOGGER.error("ConfigFlow: Detected installed supported addon: %s", slug)
                                detected_addons.append(slug)
                                break
                else:
                    _LOGGER.error("ConfigFlow: Failed to fetch addons from Supervisor: %s", resp.status)
        except Exception as err:
            _LOGGER.error("ConfigFlow: Exception in detection: %s", err)

        # If we detected something, prioritize it. Otherwise use the full list.
        display_addons = detected_addons if detected_addons else SUPPORTED_ADDON_SLUGS
        _LOGGER.error("ConfigFlow: Displaying addons: %s", display_addons)

        data_schema = vol.Schema(
            {
                vol.Required(CONF_ADDON_SLUG, default=display_addons[0] if display_addons else ""): vol.In(
                    display_addons
                ),
                vol.Required(CONF_PORT, default=DEFAULT_PORT): cv.port,
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=data_schema,
            errors=errors,
            description_placeholders={"detected": ", ".join(display_addons)},
        )

    async def async_step_hassio(self, discovery_info: dict[str, Any]) -> FlowResult:
        """Handle supervisor discovery."""
        slug = discovery_info.get("slug")
        if slug not in SUPPORTED_ADDON_SLUGS:
            return self.async_abort(reason="not_supported")

        self._addon_slug = slug
        await self.async_set_unique_id(f"{slug}_{DEFAULT_PORT}")
        self._abort_if_unique_id_configured()

        return await self.async_step_hassio_confirm()

    async def async_step_hassio_confirm(self, user_input: dict[str, Any] | None = None) -> FlowResult:
        """Confirm hassio discovery."""
        if user_input is not None:
            return self.async_create_entry(
                title=f"Webserver ({self._addon_slug})",
                data={
                    CONF_ADDON_SLUG: self._addon_slug,
                    CONF_PORT: DEFAULT_PORT,
                },
            )

        return self.async_show_form(
            step_id="hassio_confirm",
            description_placeholders={"addon": self._addon_slug},
        )
