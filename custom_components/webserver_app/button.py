import logging
import os

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity, UpdateFailed

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

        token = os.environ.get("SUPERVISOR_TOKEN")
        session = async_get_clientsession(self.coordinator.hass)
        headers = {"X-Supervisor-Token": token} if token else {}

        url = f"http://supervisor/addons/{self.addon_slug}/restart"

        try:
            async with session.post(url, headers=headers) as resp:
                if resp.status != 200:
                    _LOGGER.error("Failed to restart addon %s: %s", self.addon_slug, resp.status)
                else:
                    _LOGGER.info("Addon %s restart signal sent", self.addon_slug)
        except Exception as err:
            _LOGGER.error("Error calling Supervisor API for restart: %s", err)

        await self.coordinator.async_request_refresh()
