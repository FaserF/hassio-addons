#!/usr/bin/with-contenv bashio

# Retrieve config options using bashio
export DATABASE_URL=$(bashio::config 'database_url')
export SECRET_KEY=$(bashio::config 'secret_key')
LOG_LEVEL=$(bashio::config 'log_level')

# Configure logging level and Test Mode
if [ "$LOG_LEVEL" == "debug" ]; then
    export TEST_MODE="true"
    bashio::log.info "Debug mode enabled. Test data will be generated."
else
    export TEST_MODE="false"
fi

# Ensure the static directory exists for image uploads
if [ ! -d "/app/static/images" ]; then
    bashio::log.info "Creating static images directory..."
    mkdir -p /app/static/images
fi

bashio::log.info "Starting Nginx..."
# Start Nginx in background
nginx

bashio::log.info "Starting Solumati Backend..."
# Switch to app directory
cd /app

# Start Uvicorn
# IMPORTANT: We bind to 0.0.0.0 so that port 7777 is accessible from the outside.
# Nginx accesses it internally via localhost:7777 (this works because 0.0.0.0 covers all interfaces).
exec uvicorn main:app --host 0.0.0.0 --port 7777