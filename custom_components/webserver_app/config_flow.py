"""Config flow for the Webserver App integration."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant import config_entries
from homeassistant.components.hassio import (
    AddonInfo,
    AddonManager,
    is_hassio,
)
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import config_validation as cv

from .const import (
    CONF_ADDON_SLUG,
    CONF_PORT,
    DEFAULT_PORT,
    DOMAIN,
    SUPPORTED_ADDON_SLUGS,
)

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
        errors: dict[str, str] = {}

        if user_input is not None:
            self._addon_slug = user_input[CONF_ADDON_SLUG]
            self._port = user_input[CONF_PORT]

            # Check if already configured
            await self.async_set_unique_id(f"{self._addon_slug}_{self._port}")
            self._abort_if_unique_id_configured()

            return self.async_create_entry(
                title=f"Webserver ({self._addon_slug})",
                data=user_input,
            )

        # Auto-detect addons if running on Hass.io
        detected_addons = []
        if is_hassio(self.hass):
            try:
                # We can't easily list all addons via AddonManager here without a lot of overhead
                # but we can try to see which ones are installed
                for slug in SUPPORTED_ADDON_SLUGS:
                    # This is a bit hacky but works for discovery
                    addon_info = await self._async_get_addon_info(slug)
                    if addon_info and addon_info.get("installed"):
                        detected_addons.append(slug)
            except Exception:
                _LOGGER.error("Error detecting addons")

        data_schema = vol.Schema(
            {
                vol.Required(CONF_ADDON_SLUG, default=detected_addons[0] if detected_addons else ""): vol.In(
                    SUPPORTED_ADDON_SLUGS
                ),
                vol.Required(CONF_PORT, default=DEFAULT_PORT): cv.port,
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=data_schema,
            errors=errors,
            description_placeholders={"detected": ", ".join(detected_addons)},
        )

    async def _async_get_addon_info(self, slug: str) -> dict | None:
        """Get addon info from supervisor."""
        try:
            # Using the internal hassio component to talk to supervisor
            from homeassistant.components.hassio import async_get_addon_info

            return await async_get_addon_info(self.hass, slug)
        except Exception:
            return None

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
