# Home Assistant Test Instance

A standalone Home Assistant Core instance for testing purposes running as an add-on.

## Installation

1.  Install the add-on.
2.  Start the add-on.
3.  Access the new instance at `http://homeassistant.local:8124`.

## Configuration

Standard Home Assistant configuration is stored in the `/data` directory of the add-on container, which is persistent across restarts (unless the add-on is uninstalled).
