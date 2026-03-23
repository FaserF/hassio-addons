"""Binary sensor entities for the Webserver App integration."""

from __future__ import annotations

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
    BinarySensorEntityDescription,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CONF_ADDON_SLUG, DOMAIN
from .coordinator import WebserverAppDataUpdateCoordinator


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Webserver App binary sensors."""
    coordinator: WebserverAppDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]

    async_add_entities(
        [
            WebserverAppUpdateBinarySensor(coordinator),
        ]
    )


class WebserverAppBinarySensor(CoordinatorEntity[WebserverAppDataUpdateCoordinator], BinarySensorEntity):
    """Base class for Webserver App binary sensors."""

    _attr_has_entity_name = True

    def __init__(
        self, coordinator: WebserverAppDataUpdateCoordinator, description: BinarySensorEntityDescription
    ) -> None:
        """Initialize."""
        super().__init__(coordinator)
        self.entity_description = description
        self.addon_slug = coordinator.addon_slug
        self._attr_unique_id = f"{self.addon_slug}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, self.addon_slug)},
            name=f"Webserver ({self.addon_slug})",
            manufacturer="FaserF",
            model="Apache2/Nginx Addon",
            sw_version=coordinator.data.get("version"),
            configuration_url=f"https://github.com/FaserF/hassio-addons/tree/master/{self.addon_slug}",
        )


class WebserverAppUpdateBinarySensor(WebserverAppBinarySensor):
    """Update sensor for Webserver App."""

    def __init__(self, coordinator: WebserverAppDataUpdateCoordinator) -> None:
        """Initialize."""
        super().__init__(
            coordinator,
            BinarySensorEntityDescription(
                key="update_available",
                name="Update Available",
                device_class=BinarySensorDeviceClass.UPDATE,
            ),
        )

    @property
    def is_on(self) -> bool | None:
        """Return true if an update is available."""
        return self.coordinator.data.get("update_available")
