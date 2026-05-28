"""The Antigravity Agent Integration."""
import logging
import aiohttp
import async_timeout
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import ConfigEntryNotReady, HomeAssistantError

from .const import DOMAIN, CONF_URL, CONF_API_KEY

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Antigravity Agent from a config entry."""
    hass.data.setdefault(DOMAIN, {})

    url = entry.data.get(CONF_URL)
    api_key = entry.data.get(CONF_API_KEY)

    # Test the connection to the addon
    session = aiohttp.ClientSession()
    try:
        async with async_timeout.timeout(10):
            async with session.get(f"{url}/health") as response:
                if response.status != 200:
                    raise ConfigEntryNotReady(f"Addon healthcheck returned status: {response.status}")
    except Exception as err:
        await session.close()
        raise ConfigEntryNotReady(f"Could not connect to Antigravity Agent API at {url}: {err}") from err

    hass.data[DOMAIN][entry.entry_id] = {
        "url": url,
        "api_key": api_key,
        "session": session
    }

    # Register run_task service
    async def handle_run_task(call: ServiceCall):
        """Handle the run_task service call."""
        repository = call.data.get("repository")
        instruction = call.data.get("instruction")
        branch = call.data.get("branch")
        github_token = call.data.get("github_token")
        custom_instruction = call.data.get("custom_instruction")

        payload = {
            "repository": repository,
            "instruction": instruction,
        }
        if branch:
            payload["branch"] = branch
        if github_token:
            payload["github_token"] = github_token
        if custom_instruction:
            payload["custom_instruction"] = custom_instruction

        headers = {}
        if api_key:
            headers["X-Auth-Token"] = api_key

        # Send POST request to API
        try:
            async with async_timeout.timeout(30):
                async with session.post(f"{url}/api/task", json=payload, headers=headers) as post_response:
                    if post_response.status not in (200, 201):
                        resp_text = await post_response.text()
                        raise HomeAssistantError(f"Addon API error ({post_response.status}): {resp_text}")
                    
                    data = await post_response.json()
                    task_id = data.get("task_id")
                    status = data.get("status")
                    _LOGGER.info("Antigravity Agent triggered task: %s, status: %s", task_id, status)
                    
                    # Create a persistent notification in HA to inform the user
                    await hass.services.async_call(
                        "persistent_notification",
                        "create",
                        {
                            "title": "Antigravity Agent Task Started",
                            "message": f"Task ID: {task_id}\nRepository: {repository}\nStatus: {status}",
                            "notification_id": f"antigravity_task_{task_id[:8]}"
                        }
                    )
        except Exception as e:
            _LOGGER.error("Failed to run Antigravity Agent task: %s", e)
            raise HomeAssistantError(f"Failed to invoke Antigravity Agent API: {e}") from e

    # Register service under DOMAIN
    hass.services.async_register(
        DOMAIN,
        "run_task",
        handle_run_task
    )

    return True

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    entry_data = hass.data[DOMAIN].pop(entry.entry_id)
    await entry_data["session"].close()
    
    # Remove service if no entries are left
    if not hass.data[DOMAIN]:
        hass.services.async_remove(DOMAIN, "run_task")

    return True
