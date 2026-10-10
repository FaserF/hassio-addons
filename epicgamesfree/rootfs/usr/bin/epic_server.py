import asyncio
import json
import logging
import os
import time
from datetime import datetime

from aiohttp import web
from croniter import croniter
from epicstore_api import EpicGamesStoreAPI

# Setup basic logging
LOG_LEVEL = os.environ.get("LOG_LEVEL", "info").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO), format="%(asctime)s - %(levelname)s - %(message)s")
_LOGGER = logging.getLogger(__name__)

SESSION_FILE = "/data/session.json"
CONFIG_FILE = "/data/config.json"


class EpicGamesClaimer:
    def __init__(self):
        self.api = EpicGamesStoreAPI()
        self.session_data = {}
        self.last_claim_ts = 0
        self.next_claim_ts = 0
        self.claimed_count = 0
        self.username = None
        self.load_session()
        self.update_schedule()

    def load_session(self):
        if os.path.exists(SESSION_FILE):
            try:
                with open(SESSION_FILE, "r") as f:
                    self.session_data = json.load(f)
                    if "username" in self.session_data:
                        self.username = self.session_data["username"]
                    # Optionally set session on self.api if supported by epicstore_api
            except Exception as e:
                _LOGGER.error("Failed to load session: %s", e)

    def save_session(self):
        try:
            with open(SESSION_FILE, "w") as f:
                json.dump(self.session_data, f)
        except Exception as e:
            _LOGGER.error("Failed to save session: %s", e)

    def update_schedule(self):
        cron_expr = os.environ.get("CRON_SCHEDULE", "10 17 * * 4")
        try:
            cron = croniter(cron_expr, datetime.now())
            self.next_claim_ts = cron.get_next(float)
        except Exception as e:
            _LOGGER.error("Invalid cron expression: %s", e)

    async def claim_games(self):
        _LOGGER.info("Checking for free games to claim...")
        # Placeholder for actual claiming logic using self.api
        # Currently epicstore_api has get_free_games()
        try:
            free_games = self.api.get_free_games()
            _LOGGER.info(
                "Fetched %d free games from Epic Games API",
                len(free_games.get("data", {}).get("Catalog", {}).get("searchStore", {}).get("elements", [])),
            )
            self.last_claim_ts = time.time()
            self.claimed_count += 1
            self.update_schedule()
            return True
        except Exception as e:
            _LOGGER.error("Error during claim: %s", e)
            return False


claimer = EpicGamesClaimer()


async def handle_status(request):
    status = {
        "authenticated": claimer.username is not None,
        "username": claimer.username,
        "last_claim_ts": claimer.last_claim_ts,
        "next_claim_ts": claimer.next_claim_ts,
        "claimed_count": claimer.claimed_count,
    }
    return web.json_response(status)


async def handle_claim(request):
    success = await claimer.claim_games()
    return web.json_response({"success": success})


async def handle_games(request):
    try:
        games = claimer.api.get_free_games()
        return web.json_response(games)
    except Exception as e:
        _LOGGER.error("Error getting free games: %s", e)
        return web.json_response({"error": str(e)}, status=500)


async def handle_auth(request):
    data = await request.json()
    token = data.get("token")
    username = data.get("username")
    if token and username:
        claimer.session_data = {"token": token, "username": username}
        claimer.username = username
        claimer.save_session()
        return web.json_response({"success": True})
    return web.json_response({"success": False, "error": "Missing token or username"}, status=400)


async def serve_ui(request):
    html = """<!DOCTYPE html>
<html>
<head>
    <title>Epic Games Freebies Claimer</title>
    <style>
        body { font-family: sans-serif; padding: 20px; background: #121212; color: #fff; }
        button { padding: 10px 15px; margin-top: 10px; margin-right: 5px; background: #0078f2; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #0060c0; }
        pre { background: #1e1e1e; padding: 15px; border-radius: 4px; overflow-x: auto; }
        .card { background: #1e1e1e; padding: 15px; border-radius: 4px; margin-bottom: 15px; }
    </style>
</head>
<body>
    <h1>🎮 Epic Games Freebies Claimer</h1>
    <div class="card">
        <h3>Current Status</h3>
        <pre id="status">Loading status...</pre>
    </div>
    <button onclick="claim()">Claim Free Games Now</button>
    <button onclick="loadGames()">Refresh Available Free Games</button>
    <div class="card" style="margin-top: 20px;">
        <h3>Output</h3>
        <pre id="output">Ready.</pre>
    </div>
    <script>
        async function loadStatus() {
            const res = await fetch('/api/status');
            const data = await res.json();
            document.getElementById('status').innerText = JSON.stringify(data, null, 2);
        }
        async function claim() {
            document.getElementById('output').innerText = 'Claiming free games...';
            const res = await fetch('/api/claim', {method: 'POST'});
            const data = await res.json();
            document.getElementById('output').innerText = JSON.stringify(data, null, 2);
            loadStatus();
        }
        async function loadGames() {
            document.getElementById('output').innerText = 'Loading games...';
            const res = await fetch('/api/games');
            const data = await res.json();
            document.getElementById('output').innerText = JSON.stringify(data, null, 2);
        }
        loadStatus();
    </script>
</body>
</html>"""
    return web.Response(text=html, content_type="text/html")


async def background_scheduler():
    auto_claim = os.environ.get("AUTO_CLAIM", "true").lower() == "true"
    while True:
        if auto_claim and time.time() >= claimer.next_claim_ts:
            await claimer.claim_games()
        await asyncio.sleep(60)


async def main():
    app = web.Application()
    app.router.add_get("/", serve_ui)
    app.router.add_get("/api/status", handle_status)
    app.router.add_post("/api/claim", handle_claim)
    app.router.add_get("/api/games", handle_games)
    app.router.add_post("/api/auth", handle_auth)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", 3000)
    await site.start()

    _LOGGER.info("Server started on port 3000")

    asyncio.create_task(background_scheduler())

    # Keep the server running
    while True:
        await asyncio.sleep(3600)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
