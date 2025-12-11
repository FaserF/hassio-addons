#!/usr/bin/with-contenv bashio

# --- CONFIGURATION ---
DATA_DIR="/data/postgresql"
IMAGES_DIR="/data/images"
DB_USER="solumati"
DB_NAME="solumatidb"

bashio::log.info "Starting Solumati Add-on initialization..."

# --- FACTORY RESET CHECK (DANGEROUS!) ---
if bashio::config.true 'factory_reset'; then
	bashio::log.warning "=================================================="
	bashio::log.warning "   ⚠️  FACTORY RESET ENABLED  ⚠️"
	bashio::log.warning "=================================================="
	bashio::log.warning "ALL DATA WILL BE PERMANENTLY DELETED!"
	bashio::log.warning "This includes:"
	bashio::log.warning "  - All user accounts"
	bashio::log.warning "  - All messages and conversations"
	bashio::log.warning "  - All uploaded images"
	bashio::log.warning "  - All settings and configurations"
	bashio::log.warning "=================================================="

	# Wait 5 seconds to give user time to cancel
	bashio::log.warning "Starting reset in 5 seconds... (Stop add-on NOW to abort)"
	sleep 5

	bashio::log.info "Proceeding with factory reset..."

	# Stop PostgreSQL if running
	if [ -d "$DATA_DIR" ]; then
		bashio::log.info "Stopping PostgreSQL..."
		su postgres -c "pg_ctl stop -D $DATA_DIR -m immediate" 2>/dev/null || true
	fi

	# Delete all data
	bashio::log.info "Deleting database..."
	rm -rf "$DATA_DIR"

	bashio::log.info "Deleting uploaded images..."
	rm -rf "$IMAGES_DIR"

	bashio::log.info "=================================================="
	bashio::log.info "   ✅ FACTORY RESET COMPLETE"
	bashio::log.info "=================================================="
	bashio::log.info "All data has been deleted."
	bashio::log.info "The add-on will now restart with a fresh database."
	bashio::log.info ""
	bashio::log.warning "IMPORTANT: Disable 'factory_reset' in the add-on settings!"
	bashio::log.warning "Otherwise, the database will be wiped again on next restart."
	bashio::log.info "=================================================="

	# Continue with normal startup (fresh database will be created)
fi

# --- READ CONFIGURATION FROM HA UI ---
bashio::log.info "Reading configuration from Home Assistant..."

# Log Level (convert to uppercase for Python logging)
if bashio::config.has_value 'log_level'; then
	LOG_LEVEL=$(bashio::config 'log_level' | tr '[:lower:]' '[:upper:]')
	# Map HA log levels to Python log levels
	case "$LOG_LEVEL" in
		TRACE|DEBUG) LOG_LEVEL="DEBUG" ;;
		NOTICE|INFO) LOG_LEVEL="INFO" ;;
		WARNING) LOG_LEVEL="WARNING" ;;
		ERROR|FATAL) LOG_LEVEL="ERROR" ;;
		*) LOG_LEVEL="INFO" ;;
	esac
	export LOG_LEVEL
	bashio::log.info "Log level set to: $LOG_LEVEL"
fi

# Test Mode
if bashio::config.true 'test_mode'; then
	export TEST_MODE="true"
	bashio::log.info "Test mode: ENABLED (dummy data will be generated)"
else
	export TEST_MODE="false"
fi

# Marketing Page
if bashio::config.true 'marketing_page_enabled'; then
	export ENABLE_MARKETING_PAGE="true"
	bashio::log.info "Marketing Page: ENABLED"
else
	export ENABLE_MARKETING_PAGE="false"
	bashio::log.info "Marketing Page: DISABLED"
fi

# App Base URL (for emails, links, etc.)
if bashio::config.has_value 'app_base_url' && [ -n "$(bashio::config 'app_base_url')" ]; then
	export APP_BASE_URL=$(bashio::config 'app_base_url')
	bashio::log.info "App base URL set to: $APP_BASE_URL"
else
	# Try to auto-detect from Ingress
	if bashio::var.has_value "$(bashio::addon.ingress_url)"; then
		export APP_BASE_URL="$(bashio::addon.ingress_url)"
		bashio::log.info "App base URL auto-detected from Ingress: $APP_BASE_URL"
	else
		export APP_BASE_URL="http://homeassistant.local:8099"
		bashio::log.info "App base URL set to default: $APP_BASE_URL"
	fi
fi

# Generate random password for database
DB_PASS=$(
	tr -dc A-Za-z0-9 </dev/urandom | head -c 32
	echo ''
)

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
if ! su postgres -c "pg_ctl start -D $DATA_DIR -l /var/lib/postgresql/log.log"; then
	bashio::log.error "Failed to start PostgreSQL service"
	exit 1
fi

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
echo "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" | su postgres -c "psql"

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

bashio::log.info "Starting Backend (Uvicorn)..."
bashio::log.info "Environment: TEST_MODE=$TEST_MODE, LOG_LEVEL=${LOG_LEVEL:-INFO}"
cd /app/backend
# Start Uvicorn in background
uvicorn app.main:app --host 127.0.0.1 --port 7777 &
BACKEND_PID=$!

# --- NGINX START ---
bashio::log.info "Starting Nginx (Frontend)..."
mkdir -p /run/nginx
nginx -g "daemon off;" &
NGINX_PID=$!

bashio::log.info "Solumati is now running!"
bashio::log.info "Access via Home Assistant Ingress or http://homeassistant.local:8099"

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
