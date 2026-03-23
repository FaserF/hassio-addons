"""Utility functions for the Webserver App integration."""

from __future__ import annotations

import os
from typing import Any

from homeassistant.core import HomeAssistant


def get_supervisor_token(hass: HomeAssistant) -> str | None:
    """Get the supervisor token from environment or hass.data."""
    token = os.environ.get("SUPERVISOR_TOKEN")
    if token:
        return token

    # Try to get it from hassio component
    if "hassio" in hass.data:
        hassio = hass.data["hassio"]
        # In Home Assistant Core, the HassIO object usually stores the token in _token
        return getattr(hassio, "_token", None)

    return None


def get_supervisor_url(path: str) -> str:
    """Get the full supervisor API URL for a given path."""
    # Always use http://supervisor/ for internal calls
    return f"http://supervisor{path}"
