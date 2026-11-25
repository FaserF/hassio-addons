from homeassistant.core import HomeAssistant
from homeassistant.helpers import discovery
from homeassistant.helpers.typing import ConfigType

DOMAIN = "bash_script_executer"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the Bash Script Executer integration."""
    hass.async_create_task(discovery.async_load_platform(hass, "button", DOMAIN, {}, config))
    return True
