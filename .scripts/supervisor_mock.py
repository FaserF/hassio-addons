#!/usr/bin/env python3
"""
Mock Home Assistant Supervisor API for local add-on testing.

Provides minimal endpoints that bashio uses during add-on startup:
- GET /addons/self/options -> returns options.json content
- GET /core/info -> returns minimal core info
- GET /addons/self/info -> returns minimal addon info
- GET /supervisor/ping -> returns ok

Usage:
  python supervisor_mock.py [options_json_path] [port]

Defaults to reading options.json from current dir and port 80.
"""

import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer


class SupervisorMockHandler(BaseHTTPRequestHandler):
    options_data = {}

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


def run_server(options_path="options.json", port=80):
    # Load options
    try:
        with open(options_path, "r") as f:
            SupervisorMockHandler.options_data = json.load(f)
        print(f"Loaded options from {options_path}")
    except Exception as e:
        print(f"Warning: Could not load {options_path}: {e}")
        SupervisorMockHandler.options_data = {}

    server = HTTPServer(("0.0.0.0", port), SupervisorMockHandler)
    print(f"Mock Supervisor API running on port {port}")
    print(
        "Endpoints: /addons/self/options, /core/info, /addons/self/info, /supervisor/ping"
    )
    server.serve_forever()


if __name__ == "__main__":
    options_path = sys.argv[1] if len(sys.argv) > 1 else "options.json"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 80
    run_server(options_path, port)
