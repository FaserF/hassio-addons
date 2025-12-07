#!/usr/bin/with-contenv bashio

# --- CONFIGURATION ---
DATA_DIR="/data/postgresql"
IMAGES_DIR="/data/images"
DB_USER="solumati"
DB_NAME="solumatidb"
# Read secret from config options
DB_PASS=$(bashio::config 'secret_key')

bashio::log.info "Starting Solumati Add-on initialization..."

# --- POSTGRESQL SETUP ---
if [ ! -d "$DATA_DIR" ]; then
    bashio::log.info "Initializing PostgreSQL data directory in $DATA_DIR..."
    mkdir -p "$DATA_DIR"
    chown postgres:postgres "$DATA_DIR"

    # Initialize DB
    su postgres -c "initdb -D $DATA_DIR"
fi

# Ensure Postgres directories permissions are correct (in case of restore/restart)
mkdir -p /run/postgresql
chown -R postgres:postgres /run/postgresql
chown -R postgres:postgres "$DATA_DIR"

# Start Postgres in background
bashio::log.info "Starting PostgreSQL service..."
su postgres -c "pg_ctl start -D $DATA_DIR -l /var/lib/postgresql/log.log"

# Wait for DB to be ready
bashio::log.info "Waiting for database to be ready..."
until su postgres -c "pg_isready"; do
  sleep 1
done

# --- IDEMPOTENT DB CONFIGURATION ---
# Run this every time to ensure user exists even if first setup crashed
bashio::log.info "Ensuring database user and schema exist..."
su postgres -c "createuser -s $DB_USER" || true
su postgres -c "createdb -O $DB_USER $DB_NAME" || true
su postgres -c "psql -c \"ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';\""

# --- PERSISTENCE SETUP ---
# Handle uploaded images persistence
if [ ! -d "$IMAGES_DIR" ]; then
    mkdir -p "$IMAGES_DIR"
fi

mkdir -p /app/backend/static

# Remove the container's static/images dir and symlink to persistent storage
rm -rf /app/backend/static/images
ln -s "$IMAGES_DIR" /app/backend/static/images

# --- BACKEND START ---
export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
export APP_BASE_URL="http://homeassistant.local:8099" # Default fallback
export TEST_MODE="false"

bashio::log.info "Starting Backend (Uvicorn)..."
cd /app/backend
# Start Uvicorn in background
uvicorn main:app --host 127.0.0.1 --port 7777 &
BACKEND_PID=$!

# --- NGINX START ---
bashio::log.info "Starting Nginx (Frontend)..."
mkdir -p /run/nginx
nginx -g "daemon off;" &
NGINX_PID=$!

# Trap signals to stop processes correctly
cleanup() {
    bashio::log.info "Shutting down services..."
    
    # Stop Nginx gracefully
    kill -TERM $NGINX_PID 2>/dev/null
    wait $NGINX_PID 2>/dev/null
    
    # Stop Backend gracefully
    kill -TERM $BACKEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    
    # Stop PostgreSQL gracefully (smart mode)
    su postgres -c "pg_ctl stop -D $DATA_DIR -m smart" || true
    
    bashio::log.info "All services stopped"
    exit 0
}

trap cleanup SIGTERM SIGHUP

wait $NGINX_PID