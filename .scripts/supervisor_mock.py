#!/usr/bin/env python3
"""
Mock Home Assistant Supervisor API for local add-on testing.

Provides minimal endpoints that bashio uses during add-on startup:
- GET /addons/self/options -> returns options.json content
- GET /core/info -> returns minimal core info
- GET /addons/self/info -> returns minimal addon info
- GET /supervisor/ping -> returns ok
- GET /os/info -> returns minimal os info
- GET /host/info -> returns minimal host info
- GET /resolution/info -> returns minimal resolution info

Usage:
  python supervisor_mock.py [options_json_path] [port] [bind_address]

Arguments:
  options_json_path  Path to options.json (default: options.json)
  port               Port to listen on (default: 80)
  bind_address       Address to bind to (default: 0.0.0.0)

Environment Variables:
  MOCK_BIND_ADDRESS  Override bind address (default: 0.0.0.0)
"""

import ipaddress
import json
import os
import re
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import ClassVar


class SupervisorMockHandler(BaseHTTPRequestHandler):
    options_path: ClassVar[str] = "options.json"

    def log_message(self, format, *args):
        # Allow some logging to help debug
        sys.stderr.write(
            "%s - - [%s] %s\n"
            % (self.address_string(), self.log_date_time_string(), format % args)
        )

    def get_options(self):
        """Load options from file dynamically."""
        try:
            with open(self.options_path, "r", encoding="utf-8-sig") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError, OSError) as e:
            print(
                f"DEBUG: Failed to reload options from {self.options_path}: {e}",
                file=sys.stderr,
            )
            return {}

    def _send_json(self, data, status=200):
        response = json.dumps({"data": data, "result": "ok"})
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(response.encode())

    def do_GET(self):
        # Log request details for debugging
        print(
            f"DEBUG: GET request to {self.path} from {self.client_address}",
            file=sys.stderr,
        )

        # Reload options dynamically
        current_options = self.get_options()

        if (
            self.path == "/addons/self/options"
            or self.path == "/addons/self/options/config"
            or re.match(r"^/addons/[^/]+/options$", self.path)
        ):
            self._send_json(current_options)
        elif self.path == "/core/info":
            self._send_json(
                {
                    "version": "2025.12.3",
                    "arch": "amd64",
                    "machine": "qemux86-64",
                    "state": "running",
                }
            )
        elif self.path == "/addons/self/info" or re.match(
            r"^/addons/[^/]+/info$", self.path
        ):
            self._send_json(
                {
                    "name": "Test Add-on",
                    "slug": "local_test",
                    "state": "started",
                    "version": "1.0.0",
                    "ingress": False,
                    "options": current_options,
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
                    "supported": True,
                    "healthy": True,
                }
            )
        elif self.path == "/os/info":
            self._send_json(
                {
                    "version": "16.3",
                    "upgrade": "16.3",
                    "board": "ova",
                    "boot": "B",
                    "update_available": False,
                }
            )
        elif self.path == "/host/info":
            self._send_json(
                {
                    "chassis": "vm",
                    "operating_system": "Home Assistant OS 16.3 (mocked)",
                    "kernel": "6.12.51-haos",
                    "hostname": "homeassistant",
                    "features": [
                        "reboot",
                        "shutdown",
                        "services",
                        "network",
                        "hostname",
                    ],
                    "disk_free": 1000,
                    "disk_total": 2000,
                    "disk_used": 1000,
                    "deployment": "production",
                }
            )
        elif self.path == "/resolution/info":
            self._send_json(
                {
                    "unsupported": [],
                    "unhealthy": [],
                    "suggestions": [],
                    "issues": [],
                    "checks": [],
                }
            )
        elif self.path == "/discovery":
            self._send_json({"discovery": []})
        elif self.path == "/addons":
            self._send_json({"addons": []})
        elif self.path == "/info":
            self._send_json(
                {
                    "supervisor": "2025.12.3",
                    "homeassistant": "2025.12.3",
                    "hassos": "16.3",
                }
            )
        elif self.path == "/store":
            self._send_json({"repositories": [], "addons": []})
        elif self.path == "/dns/info":
            self._send_json(
                {
                    "host": "172.30.32.3",
                    "version": "2025.12.3",
                    "servers": [],
                    "locals": [],
                }
            )
        elif self.path == "/audio/info":
            self._send_json(
                {
                    "host": "172.30.32.1",
                    "version": "2025.12.3",
                    "input": "default",
                    "output": "default",
                }
            )
        elif self.path == "/multicast/info":
            self._send_json({"host": "172.30.32.1", "version": "2025.12.3"})
        else:
            # Return empty success for unknown endpoints
            self._send_json({})

    def do_POST(self):
        # Log POST request details
        print(
            f"DEBUG: POST request to {self.path} from {self.client_address}",
            file=sys.stderr,
        )
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


def run_server(options_path="options.json", port=80, bind_address="0.0.0.0"):
    """Start the mock Supervisor API server."""
    # Set the options path for dynamic loading
    SupervisorMockHandler.options_path = options_path
    print(f"Mock server configured to serve options from: {options_path}")

    # Validate bind address
    bind_address = validate_bind_address(bind_address)

    server = HTTPServer((bind_address, port), SupervisorMockHandler)
    print(f"Mock Supervisor API running on {bind_address}:{port}")
    print(
        "Endpoints: /addons/self/options, /core/info, /addons/self/info, /supervisor/ping, /os/info, /host/info"
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
        else os.environ.get("MOCK_BIND_ADDRESS", "0.0.0.0")
    )
    run_server(options_path, port, bind_address)
