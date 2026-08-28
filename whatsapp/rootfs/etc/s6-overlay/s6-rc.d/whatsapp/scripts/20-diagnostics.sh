#!/usr/bin/with-contenv bashio
# shellcheck disable=SC1091,SC2155
# shellcheck shell=bash

cd /opt/whatsapp || exit 1

bashio::log.info "Running pre-flight diagnostics..."

THROTTLE_FILE="/data/infra_failure_throttle"
BACKOFF_DELAY=120

if [ -f "$THROTTLE_FILE" ]; then
	FAIL_COUNT=$(cat "$THROTTLE_FILE")
	FAIL_COUNT=$((FAIL_COUNT + 1))
	echo "$FAIL_COUNT" >"$THROTTLE_FILE"

	if [ "$FAIL_COUNT" -gt 5 ]; then
		BACKOFF_DELAY=900 # 15 minutes
	elif [ "$FAIL_COUNT" -gt 2 ]; then
		BACKOFF_DELAY=300 # 5 minutes
	fi
	bashio::log.warning "Consecutive infrastructure failures detected (#$FAIL_COUNT). Throttling restart for ${BACKOFF_DELAY}s..."
else
	echo "1" >"$THROTTLE_FILE"
fi

# 1. Dependency Check (node_modules)
bashio::log.debug "Checking if node_modules folder exists..."
if [ ! -d "node_modules" ]; then
	bashio::log.fatal "❌ CRITICAL ERROR: node_modules folder is missing!"
	bashio::log.fatal "This is usually caused by an interrupted build or a failed npm install."
	bashio::log.fatal "ACTION REQUIRED: Please try to REBUILD the addon in Home Assistant."
	sleep "$BACKOFF_DELAY"
	exit 1
fi

# 2. Syntax & Module Resolution Check
bashio::log.debug "Checking syntax and module resolution..."
if ! node -e "import('express').then(() => process.exit(0)).catch((e) => { console.error(e.message); process.exit(1); })" --input-type=module >/tmp/diag_out 2>&1; then
	bashio::log.fatal "❌ CRITICAL ERROR: Infrastructure / Dependency resolution failed!"
	bashio::log.fatal "Internal Error: $(cat /tmp/diag_out)"
	bashio::log.fatal "NOTE: This is NOT a Baileys connection bug. It's a system-level failure."
	bashio::log.fatal "ACTION REQUIRED: Check if you are on the latest addon version or try a REBUILD."
	sleep "$BACKOFF_DELAY"
	exit 1
fi

# 3. Code Integrity Check
bashio::log.debug "Checking index.js code syntax integrity..."
if ! node --check index.js >/tmp/diag_out 2>&1; then
	bashio::log.fatal "❌ CRITICAL ERROR: JavaScript Syntax or Integrity error detected!"
	bashio::log.fatal "Error Detail: $(cat /tmp/diag_out)"
	bashio::log.fatal "ACTION REQUIRED: Please report this error to the addon developer."
	sleep "$BACKOFF_DELAY"
	exit 1
fi

# Clear throttle on success
rm -f "$THROTTLE_FILE"
bashio::log.info "✅ Pre-flight checks passed."

# Always re-read integration version from the live manifest.json right before starting Node.
if [ -f "$INTEGRATION_DIR/manifest.json" ]; then
	INTEGRATION_VERSION=$(jq -r '.version // "unknown"' "$INTEGRATION_DIR/manifest.json")
	export INTEGRATION_VERSION
	bashio::log.info "📦 Integration Version (live): ${INTEGRATION_VERSION}"
else
	export INTEGRATION_VERSION="${INTEGRATION_VERSION:-unknown}"
	bashio::log.warning "⚠️ manifest.json not found, using cached INTEGRATION_VERSION: ${INTEGRATION_VERSION}"
fi
