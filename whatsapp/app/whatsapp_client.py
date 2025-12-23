"""Real Browser-based API Client for HA WhatsApp (Playwright)."""
from __future__ import annotations

import base64
import logging
import asyncio
from typing import Any, Callable, Optional

from playwright.async_api import async_playwright, Page, Browser, Playwright, BrowserContext

# Setup explicit logger for standalone app
logging.basicConfig(level=logging.INFO)
_LOGGER = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"

class WhatsAppApiClient:
    """WhatsApp Web Client using Playwright."""

    def __init__(self, user_data_dir: str | None = None) -> None:
        """Initialize."""
        self.user_data_dir = user_data_dir or "/data/session"
        self._connected = False

        # Playwright objects
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._context: BrowserContext | None = None
        self._page: Page | None = None

    async def initialize_browser(self, headless: bool = True) -> None:
        """Start the browser."""
        _LOGGER.debug("Starting Playwright...")
        self._playwright = await async_playwright().start()

        _LOGGER.debug("Launching persistent context at %s", self.user_data_dir)
        # In Addon, we run as root inside Docker, so we might need args
        self._context = await self._playwright.chromium.launch_persistent_context(
            self.user_data_dir,
            headless=headless,
            user_agent=USER_AGENT,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )

        if len(self._context.pages) > 0:
            self._page = self._context.pages[0]
        else:
            self._page = await self._context.new_page()

        await self._page.goto("https://web.whatsapp.com")
        _LOGGER.debug("Navigated to WhatsApp Web")

    async def get_qr_code(self) -> str:
        """Get the QR code as base64 string."""
        if not self._page:
            await self.initialize_browser()

        assert self._page

        try:
             qr_element = await self._page.wait_for_selector("canvas", timeout=30000)
             if qr_element:
                 png_bytes = await qr_element.screenshot()
                 base64_str = base64.b64encode(png_bytes).decode("utf-8")
                 return f"data:image/png;base64,{base64_str}"
        except Exception as e:
            _LOGGER.error("Failed to find QR code: %s", e)

        return ""

    async def connect(self) -> bool:
        """Wait for successful login."""
        if not self._page:
            return False

        try:
            await self._page.wait_for_selector('div[contenteditable="true"][data-tab="3"]', timeout=60000)
            self._connected = True
            return True
        except Exception as e:
            _LOGGER.error("Timeout waiting for login: %s", e)
            return False

    async def is_connected(self) -> bool:
        """Check connection status."""
        return self._connected

    async def send_message(self, number: str, message: str) -> None:
        """Send a message."""
        if not self._connected or not self._page:
            raise ConnectionError("Not connected")

        # Simplified "Direct Link" approach
        target_url = f"https://web.whatsapp.com/send?phone={number.replace('+', '')}&text={message}"
        await self._page.goto(target_url)

        # Wait for Send Button
        send_btn = await self._page.wait_for_selector('span[data-icon="send"]', timeout=30000)
        if send_btn:
            await send_btn.click()
            _LOGGER.info("Message sent to %s", number)
            await asyncio.sleep(2)
        else:
            _LOGGER.error("Send button not found")

    async def close(self) -> None:
        """Close resources."""
        if self._context:
            await self._context.close()
        if self._playwright:
            await self._playwright.stop()
