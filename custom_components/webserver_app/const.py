"""Constants for the Webserver App integration."""

DOMAIN = "webserver_app"

CONF_ADDON_SLUG = "addon_slug"
CONF_PORT = "port"

DEFAULT_PORT = 80

SUPPORTED_ADDON_SLUGS = [
    "apache2",
    "apache2-edge",
    "apache2-minimal",
    "apache2-minimal-edge",
    "apache2-minimal-mariadb",
    "apache2-minimal-mariadb-edge",
    "nginx",
    "nginx-edge",
]
