"""Button platform for the Webserver App integration."""

from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.components.hassio import async_restart_addon
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_ADDON_SLUG, DOMAIN
from .coordinator import WebserverAppDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the button platform."""
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([WebserverAppReloadButton(coordinator)])


class WebserverAppReloadButton(CoordinatorEntity[WebserverAppDataUpdateCoordinator], ButtonEntity):
    """Button to reload the webserver (via addon restart for now)."""

    _attr_translation_key = "reload"
    _attr_has_entity_name = True

    def __init__(self, coordinator: WebserverAppDataUpdateCoordinator) -> None:
        """Initialize."""
        super().__init__(coordinator)
        self.addon_slug = coordinator.addon_slug
        self._attr_unique_id = f"{self.addon_slug}_reload"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, self.addon_slug)},
        )

    async def async_press(self) -> None:
        """Handle the button press."""
        _LOGGER.info("Reload requested for addon %s", self.addon_slug)
        # Graceful reload is hard via Supervisor API for generic addons,
        # so we perform a restart of the addon.
        await async_restart_addon(self.hass, self.addon_slug)
        await self.coordinator.async_request_refresh()
