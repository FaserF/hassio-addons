#!/usr/bin/env python3
"""
Mock Home Assistant Supervisor API for local add-on testing.

Provides minimal endpoints that bashio uses during add-on startup:
- GET /addons/self/options -> returns options.json content
- GET /core/info -> returns minimal core info
- GET /addons/self/info -> returns minimal addon info
- GET /supervisor/ping -> returns ok

Usage:
  python supervisor_mock.py [options_json_path] [port] [bind_address]

Arguments:
  options_json_path  Path to options.json (default: options.json)
  port               Port to listen on (default: 80)
  bind_address       Address to bind to (default: 127.0.0.1)

Environment Variables:
  MOCK_BIND_ADDRESS  Override bind address (default: 127.0.0.1)

Examples:
  # Local testing (safe default - localhost only)
  python supervisor_mock.py /data/options.json 80

  # Containerized/multi-host testing (bind to all interfaces)
  python supervisor_mock.py /data/options.json 80 0.0.0.0
  # or via environment:
  MOCK_BIND_ADDRESS=0.0.0.0 python supervisor_mock.py /data/options.json 80
"""

import ipaddress
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import ClassVar


class SupervisorMockHandler(BaseHTTPRequestHandler):
    options_data: ClassVar[dict] = {}

    def log_message(self, format, *args):
        # Suppress logging for cleaner output
        pass

    def _send_json(self, data, status=200):
        response = json.dumps({"data": data, "result": "ok"})
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(response.encode())

    def do_GET(self):
        if self.path == "/addons/self/options":
            self._send_json(self.options_data)
        elif self.path == "/core/info":
            self._send_json(
                {
                    "version": "2025.1.0",
                    "arch": "amd64",
                    "machine": "generic-x86-64",
                    "state": "running",
                }
            )
        elif self.path == "/addons/self/info":
            self._send_json(
                {
                    "name": "Test Add-on",
                    "slug": "local_test",
                    "state": "started",
                    "version": "1.0.0",
                    "ingress": False,
                    "options": self.options_data,
                }
            )
        elif self.path == "/supervisor/ping":
            self._send_json({})
        elif self.path == "/supervisor/info":
            self._send_json(
                {
                    "version": "2025.12.3",
                    "channel": "stable",
                    "arch": "amd64",
                    "logging": "info",
                }
            )
        else:
            # Return empty success for unknown endpoints
            self._send_json({})

    def do_POST(self):
        # Handle POST requests (some bashio calls use POST)
        self._send_json({})


def validate_bind_address(address: str) -> str:
    """Validate and return a bind address, defaulting to 127.0.0.1 if invalid."""
    try:
        ipaddress.ip_address(address)
    except ValueError:
        print(f"Warning: Invalid bind address '{address}', using 127.0.0.1")
        return "127.0.0.1"
    else:
        return address


def run_server(options_path="options.json", port=80, bind_address="127.0.0.1"):
    """Start the mock Supervisor API server."""
    # Load options with specific exception handling
    try:
        with open(options_path, "r") as f:
            SupervisorMockHandler.options_data = json.load(f)
        print(f"Loaded options from {options_path}")
    except FileNotFoundError:
        print(f"Warning: Options file not found: {options_path}")
        SupervisorMockHandler.options_data = {}
    except PermissionError as e:
        print(f"Warning: Permission denied reading {options_path}: {e}")
        SupervisorMockHandler.options_data = {}
    except json.JSONDecodeError as e:
        print(f"Warning: Invalid JSON in {options_path}: {e}")
        SupervisorMockHandler.options_data = {}
    # Let other unexpected exceptions propagate

    # Validate bind address
    bind_address = validate_bind_address(bind_address)

    server = HTTPServer((bind_address, port), SupervisorMockHandler)
    print(f"Mock Supervisor API running on {bind_address}:{port}")
    print(
        "Endpoints: /addons/self/options, /core/info, /addons/self/info, /supervisor/ping"
    )
    server.serve_forever()


if __name__ == "__main__":
    options_path = sys.argv[1] if len(sys.argv) > 1 else "options.json"

    # Validate port argument
    if len(sys.argv) > 2:
        try:
            port = int(sys.argv[2])
            if not (1 <= port <= 65535):
                print(f"Warning: Port {port} out of range, using 80")
                port = 80
        except ValueError:
            print(f"Warning: Invalid port '{sys.argv[2]}', using 80")
            port = 80
    else:
        port = 80

    # Bind address: CLI arg > env var > safe default
    bind_address = (
        sys.argv[3]
        if len(sys.argv) > 3
        else os.environ.get("MOCK_BIND_ADDRESS", "127.0.0.1")
    )
    run_server(options_path, port, bind_address)
