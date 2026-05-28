"""Config flow for Antigravity Agent integration."""
import voluptuous as vol
from homeassistant import config_entries
from .const import DOMAIN, CONF_URL, CONF_API_KEY, DEFAULT_PORT

class AntigravityAgentConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Antigravity Agent."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            # Simple validation - ensure URL is set
            url = user_input.get(CONF_URL, "")
            if not url.startswith("http://") and not url.startswith("https://"):
                errors["base"] = "invalid_url"
            else:
                return self.async_create_entry(
                    title="Antigravity Agent Connection",
                    data=user_input
                )

        # Show form
        data_schema = vol.Schema({
            vol.Required(CONF_URL, default=f"http://localhost:{DEFAULT_PORT}"): str,
            vol.Optional(CONF_API_KEY): str,
        })

        return self.async_show_form(
            step_id="user",
            data_schema=data_schema,
            errors=errors,
        )
