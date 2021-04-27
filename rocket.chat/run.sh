#!/usr/bin/with-contenv bashio

echo "Starting Rocket.Chat"
systemctl start rocketchat
tail -f /var/log/messages