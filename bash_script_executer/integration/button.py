from homeassistant.components.button import ButtonEntity
from homeassistant.core import HomeAssistant

async def async_setup_platform(hass, config, async_add_entities, discovery_info=None):
    """Set up the button platform."""
    async_add_entities([BashScriptExecuterButton()])

class BashScriptExecuterButton(ButtonEntity):
    """Button to start the Bash Script Executer addon."""
    
    _attr_name = "Bash Script Executer: Start"
    _attr_unique_id = "bash_script_executer_start"
    _attr_icon = "mdi:play"

    async def async_press(self) -> None:
        """Handle the button press."""
        await self.hass.services.async_call(
            "hassio", "addon_start", {"addon": "bashscriptexecuter"}
        )
