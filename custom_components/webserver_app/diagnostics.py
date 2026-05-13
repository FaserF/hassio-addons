"""Diagnostics support for Webserver App integration."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.components.diagnostics import async_redact_data
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .coordinator import WebserverAppDataUpdateCoordinator

REDACT_KEYS = {
    "supervisor_token",
    "token",
    "password",
    "secret",
}


def _to_json_safe(obj: Any) -> Any:
    """Convert an object to a JSON-serializable format."""
    if isinstance(obj, (bool, int, float, str)) or obj is None:
        return obj
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, (list, tuple, set)):
        return [_to_json_safe(i) for i in obj]
    if isinstance(obj, dict):
        return {str(k): _to_json_safe(v) for k, v in obj.items()}
    if hasattr(obj, "__dict__"):
        return _to_json_safe(obj.__dict__)
    return str(obj)


async def async_get_config_entry_diagnostics(
    hass: HomeAssistant,
    entry: ConfigEntry,
) -> dict[str, Any]:
    """Return diagnostics for a config entry."""
    coordinator: WebserverAppDataUpdateCoordinator | None = hass.data.get(DOMAIN, {}).get(entry.entry_id)

    diag: dict[str, Any] = {
        "config_entry": {
            "title": entry.title,
            "data": async_redact_data(dict(entry.data), REDACT_KEYS),
            "options": async_redact_data(dict(entry.options), REDACT_KEYS),
            "domain": entry.domain,
            "entry_id": entry.entry_id,
        },
    }

    if coordinator:
        diag["coordinator"] = {
            "last_update_success": coordinator.last_update_success,
            "addon_slug": coordinator.addon_slug,
            "data": _to_json_safe(coordinator.data) if coordinator.data else None,
        }
    else:
        diag["coordinator"] = "Coordinator not initialized"

    # Registry debug: inspect created devices and entities
    reg_devices = []
    reg_entities = []

    try:
        dev_reg = dr.async_get(hass)
        ent_reg = er.async_get(hass)

        for _dev in dev_reg.devices.values():
            if entry.entry_id not in _dev.config_entries:
                continue

            reg_devices.append(
                {
                    "id": str(_dev.id),
                    "name": str(_dev.name or ""),
                    "model": str(_dev.model or ""),
                    "manufacturer": str(_dev.manufacturer or ""),
                    "sw_version": str(_dev.sw_version or ""),
                    "identifiers": [list(i) for i in _dev.identifiers],
                }
            )

        for _ent in er.async_entries_for_config_entry(ent_reg, entry.entry_id):
            reg_entities.append(
                {
                    "entity_id": str(_ent.entity_id),
                    "unique_id": str(_ent.unique_id),
                    "domain": str(_ent.domain),
                    "original_name": str(_ent.original_name or ""),
                    "disabled": _ent.disabled_by is not None,
                }
            )
    except Exception as err:
        diag["registry_debug_error"] = str(err)

    diag["registry_debug"] = {
        "devices": reg_devices,
        "entities": reg_entities,
    }

    return _to_json_safe(diag)
