#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

export KEEP_ALIVE_INTERVAL=$(bashio::config 'keep_alive_interval' 600)
export LOG_LEVEL=$(bashio::config 'log_level' 'info')

bashio::log.info "Environment configured (KeepAlive: ${KEEP_ALIVE_INTERVAL}s, LogLevel: ${LOG_LEVEL})"