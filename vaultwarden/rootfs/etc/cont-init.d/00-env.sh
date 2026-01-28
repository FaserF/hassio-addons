#!/usr/bin/env bash
# ==============================================================================
# Home Assistant Community Add-on: Vaultwarden
# Ensure s6 environment structure exists before services start
# ==============================================================================
mkdir -p /var/run/s6/container_environment
mkdir -p /run/s6/container_environment
