"""Tests for the Webserver App integration."""

from unittest.mock import MagicMock, patch

import pytest
from homeassistant.components.hassio import DOMAIN as HASSIO_DOMAIN
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from custom_components.webserver_app.const import CONF_ADDON_SLUG, CONF_PORT, DOMAIN


async def test_setup_entry(hass: HomeAssistant) -> None:
    """Test setting up the integration."""
    entry = MagicMock()
    entry.data = {
        CONF_ADDON_SLUG: "apache2",
        CONF_PORT: 80,
    }
    entry.entry_id = "test_entry"

    # Mock Supervisor API
    with patch("custom_components.webserver_app.coordinator.get_supervisor_token", return_value="fake_token"), \
         patch("custom_components.webserver_app.coordinator.async_get_clientsession") as mock_session_get:
        
        mock_session = AsyncMock()
        mock_session_get.return_value = mock_session
        
        mock_resp = AsyncMock()
        mock_resp.status = 200
        mock_resp.json.return_value = {
            "data": {"name": "Apache2", "version": "3.3.0", "state": "started", "update_available": False}
        }
        mock_session.get.return_value = mock_resp

        assert await hass.config_entries.async_setup_entry(entry, "webserver_app")
    await hass.async_block_till_done()

    assert DOMAIN in hass.data
    assert "test_entry" in hass.data[DOMAIN]


async def test_config_flow(hass: HomeAssistant) -> None:
    """Test the config flow."""
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": "user"})
    assert result["type"] == "form"
    assert result["step_id"] == "user"

    with patch(
        "custom_components.webserver_app.config_flow.async_get_addon_info",
        return_value={"installed": True},
    ):
        result = await hass.config_entries.flow.async_configure(
            result["flow_id"],
            {
                CONF_ADDON_SLUG: "apache2",
                CONF_PORT: 80,
            },
        )
        assert result["type"] == "create_entry"
        assert result["title"] == "Webserver (apache2)"
        assert result["data"] == {
            CONF_ADDON_SLUG: "apache2",
            CONF_PORT: 80,
        }
