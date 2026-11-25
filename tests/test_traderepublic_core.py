"""Unit tests for Trade Republic add-on core services (WS keeper, browser service, API)."""

from __future__ import annotations

import asyncio
import sys
import types
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

TR_APP_DIR = Path(__file__).resolve().parent.parent / "traderepublic" / "app"
if str(TR_APP_DIR) not in sys.path:
    sys.path.insert(0, str(TR_APP_DIR))


def _ensure_optional_runtime_modules() -> None:
    """Provide minimal stubs only when optional runtime deps are absent (e.g. minimal CI)."""
    if "aiohttp" not in sys.modules:
        try:
            import aiohttp  # noqa: F401
        except ImportError:
            aiohttp_stub = types.ModuleType("aiohttp")
            aiohttp_stub.ClientSession = MagicMock  # type: ignore[attr-defined]
            aiohttp_stub.ClientTimeout = lambda **kw: MagicMock()  # type: ignore[attr-defined]
            sys.modules["aiohttp"] = aiohttp_stub

    if "websockets" not in sys.modules:
        try:
            import websockets  # noqa: F401
        except ImportError:
            ws_stub = types.ModuleType("websockets")
            ws_stub.connect = AsyncMock()  # type: ignore[attr-defined]
            sys.modules["websockets"] = ws_stub

    if "fastapi" not in sys.modules:
        try:
            import fastapi  # noqa: F401
        except ImportError:
            fastapi_stub = types.ModuleType("fastapi")

            class _FakeFastAPI:
                def __init__(self, **kw):
                    self.kw = kw

                def middleware(self, *a, **kw):
                    return lambda fn: fn

                def mount(self, *a, **kw):
                    return None

                def get(self, *a, **kw):
                    return lambda fn: fn

                def post(self, *a, **kw):
                    return lambda fn: fn

            fastapi_stub.FastAPI = _FakeFastAPI  # type: ignore[attr-defined]
            fastapi_stub.HTTPException = Exception  # type: ignore[attr-defined]
            fastapi_stub.Request = object  # type: ignore[attr-defined]
            fastapi_stub.Security = lambda *a, **kw: None  # type: ignore[attr-defined]

            resp_stub = types.ModuleType("fastapi.responses")
            resp_stub.HTMLResponse = object  # type: ignore[attr-defined]
            sec_stub = types.ModuleType("fastapi.security.api_key")
            sec_stub.APIKeyHeader = lambda **kw: None  # type: ignore[attr-defined]
            stat_stub = types.ModuleType("fastapi.staticfiles")
            stat_stub.StaticFiles = lambda **kw: None  # type: ignore[attr-defined]
            tmpl_stub = types.ModuleType("fastapi.templating")
            tmpl_stub.Jinja2Templates = lambda **kw: MagicMock()  # type: ignore[attr-defined]
            pyd_stub = types.ModuleType("pydantic")
            pyd_stub.BaseModel = object  # type: ignore[attr-defined]

            sys.modules["fastapi"] = fastapi_stub
            sys.modules["fastapi.responses"] = resp_stub
            sys.modules["fastapi.security"] = types.ModuleType("fastapi.security")
            sys.modules["fastapi.security.api_key"] = sec_stub
            sys.modules["fastapi.staticfiles"] = stat_stub
            sys.modules["fastapi.templating"] = tmpl_stub
            sys.modules.setdefault("pydantic", pyd_stub)


_ensure_optional_runtime_modules()

from browser import TradeRepublicBrowserService  # noqa: E402
from core.ws_keeper import TRWebSocketKeeper  # noqa: E402


def test_ws_keeper_stops_immediately_on_connect_401():
    """HTTP 401 on WebSocket connect should trigger at most 1 rotation, then stop and notify."""

    async def _run():
        auth_lost = AsyncMock()
        refresh_cb = AsyncMock(return_value=None)
        keeper = TRWebSocketKeeper(
            token_factory=lambda: "expired_jwt",
            on_auth_lost_callback=auth_lost,
            on_token_refresh=refresh_cb,
        )
        keeper._running = True

        err_401 = Exception("server rejected WebSocket connection: HTTP 401")
        with patch("core.ws_keeper.websockets.connect", new=AsyncMock(side_effect=err_401)):
            connected = await keeper._connect()

        assert connected is False
        assert keeper._running is False
        assert keeper.is_authenticated is False
        assert keeper.last_error and "401" in keeper.last_error
        assert refresh_cb.await_count == 1
        assert auth_lost.await_count == 1

    asyncio.run(_run())


def test_ws_keeper_stops_on_handshake_401():
    """Handshake rejection with 401 should stop keeper after single rotation attempt."""

    async def _run():
        auth_lost = AsyncMock()
        refresh_cb = AsyncMock(return_value=None)
        keeper = TRWebSocketKeeper(
            token_factory=lambda: "expired_jwt",
            on_auth_lost_callback=auth_lost,
            on_token_refresh=refresh_cb,
        )
        keeper._running = True

        mock_ws = AsyncMock()
        mock_ws.recv = AsyncMock(return_value='26 E {"error":"401 Unauthorized"}')
        with patch("core.ws_keeper.websockets.connect", new=AsyncMock(return_value=mock_ws)):
            connected = await keeper._connect()

        assert connected is False
        assert keeper._running is False
        assert keeper.is_authenticated is False
        assert refresh_cb.await_count == 1
        assert auth_lost.await_count == 1

    asyncio.run(_run())


def test_ws_keeper_sync_categories_preserves_timeline_when_webhook_enabled():
    """Timeline subscription must stay active when webhooks are enabled."""

    async def _run():
        keeper = TRWebSocketKeeper(token_factory=lambda: "tok")
        keeper.webhook.enabled = True
        keeper.is_authenticated = True
        keeper._ws = AsyncMock()
        keeper._subscribed_categories = {"portfolio": 10, "cash": 11, "timeline": 12, "savings": 13}
        keeper._sub_map = {10: "portfolio", 11: "cash", 12: "timeline", 13: "savings"}

        await keeper.sync_categories({"portfolio", "cash"})

        assert "timeline" in keeper.active_categories
        assert "timeline" in keeper._subscribed_categories
        assert "savings" not in keeper._subscribed_categories
        sent_cmds = [call.args[0] for call in keeper._ws.send.await_args_list]
        assert "unsub 13" in sent_cmds
        assert "unsub 12" not in sent_cmds

    asyncio.run(_run())


def test_ws_keeper_crypto_instrument_and_fallback_resolution():
    """Crypto without exchangeIds resolves via instrument sub and falls back on E."""

    async def _run():
        keeper = TRWebSocketKeeper(token_factory=lambda: "tok")
        keeper.is_authenticated = True
        keeper._ws = AsyncMock()
        keeper._sub_map = {10: "portfolio"}
        keeper._sub_counter = 11

        portfolio_msg = (
            '10 A {"categories":[{"categoryType":"cryptos","positions":'
            '[{"isin":"XF000BTC0017","averageBuyIn":"80000","netSize":"0.1","instrumentType":"crypto","name":"Bitcoin"}]}]}'
        )
        await keeper._handle_message(portfolio_msg)

        assert len(keeper._instrument_subs) == 1
        inst_sub_id = next(iter(keeper._instrument_subs.keys()))
        keeper._ws.send.assert_any_await(f'sub {inst_sub_id} {{"type":"instrument","id":"XF000BTC0017"}}')

        await keeper._handle_message(f'{inst_sub_id} A {{"exchangeIds":["BHS"]}}')
        assert len(keeper._ticker_subs) == 1
        ticker_sub_id = next(iter(keeper._ticker_subs.keys()))
        keeper._ws.send.assert_any_await(f'sub {ticker_sub_id} {{"type":"ticker","id":"XF000BTC0017.BHS"}}')

        await keeper._handle_message(f"{ticker_sub_id} E {{}}")
        assert len(keeper._ticker_subs) == 1
        fallback_sub_id = next(iter(keeper._ticker_subs.keys()))
        keeper._ws.send.assert_any_await(f'sub {fallback_sub_id} {{"type":"ticker","id":"XF000BTC0017.B2C"}}')

        await keeper._handle_message(f'{fallback_sub_id} A {{"last":{{"price":90000.0}}}}')
        assert keeper.latest_data["value_crypto"] == pytest.approx(9000.0)
        assert keeper.latest_data["total_profit"] == pytest.approx(1000.0)

    asyncio.run(_run())


def test_browser_service_get_qr_code_skips_navigation_when_logged_in():
    """get_qr_code must not navigate Chromium to /login when already authenticated."""

    async def _run():
        svc = TradeRepublicBrowserService()
        svc.cdp = MagicMock()
        svc.cdp.send_cmd = AsyncMock()
        svc.is_logged_in = True

        res = await svc.get_qr_code(force_refresh=False)
        assert res["is_logged_in"] is True
        assert res["qr_code"] is None
        svc.cdp.send_cmd.assert_not_awaited()

    asyncio.run(_run())


def test_browser_service_finalize_login_is_idempotent():
    """Concurrent finalize calls for the same token must save session and update keeper once."""

    async def _run():
        svc = TradeRepublicBrowserService()

        async def _fake_save(tok, **kw):
            svc.session_token = tok
            svc._is_logged_in_override = True

        svc._ws_keeper = MagicMock()
        svc._ws_keeper.is_authenticated = True
        svc._ws_keeper.wait_until_connected = AsyncMock(return_value=True)

        with patch.object(svc, "save_session", AsyncMock(side_effect=_fake_save)) as mock_save:
            await svc._finalize_login("jwt_token_123", "app_poller")
            await svc._finalize_login("jwt_token_123", "submit_2fa")

            assert mock_save.await_count == 1
        assert svc._ws_keeper.wait_until_connected.await_count == 1

    asyncio.run(_run())


def test_main_data_endpoint_connecting_vs_expired_states():
    """/api/v1/data distinguishes connecting handshake state from expired auth state."""
    import main as tr_main

    async def _run():
        with patch.object(tr_main, "browser_service") as mock_svc:
            mock_keeper = MagicMock()
            mock_keeper.latest_data = {}
            mock_keeper.last_data_update_time = None
            mock_keeper.is_authenticated = False
            mock_keeper.is_connecting = True
            mock_keeper.last_error = None
            mock_keeper.sync_categories = AsyncMock()
            mock_svc._ws_keeper = mock_keeper
            mock_svc.is_logged_in = False
            mock_svc.session_token = "tok"
            mock_svc._is_logged_in_override = None
            mock_svc.phone_number = "+491701234567"
            mock_svc.client_requests_count = 0
            mock_svc.request_counts_by_type = {"data": 0, "session": 0, "refresh": 0, "status": 0}

            res_connecting = await tr_main.get_data(categories="portfolio,cash")
            assert res_connecting["is_logged_in"] is True
            assert res_connecting["is_connecting"] is True
            assert res_connecting["auth_expired"] is False

            mock_keeper.is_connecting = False
            mock_keeper.last_error = "HTTP 401"
            mock_svc._is_logged_in_override = False
            res_expired = await tr_main.get_data(categories="portfolio,cash")
            assert res_expired["is_logged_in"] is False
            assert res_expired["is_connecting"] is False
            assert res_expired["auth_expired"] is True

    asyncio.run(_run())
