#!/usr/bin/with-contenv bashio

# --- CONFIGURATION ---
DATA_DIR="/data/postgresql"
IMAGES_DIR="/data/images"
DB_USER="fluxid"
DB_NAME="fluxiddb"

bashio::log.info "Starting FluxID Add-on initialization..."

# --- READ CONFIGURATION ---
GITHUB_URL=$(bashio::config 'github_url')
GITHUB_TOKEN=$(bashio::config 'github_token')
GITHUB_BRANCH=$(bashio::config 'github_branch')
LOG_LEVEL=$(bashio::config 'log_level')

# Log Level
export LOG_LEVEL=$(echo "$LOG_LEVEL" | tr '[:lower:]' '[:upper:]')
bashio::log.info "Log level: $LOG_LEVEL"

# --- CHECK TOKEN ---
if [ -z "$GITHUB_TOKEN" ]; then
    bashio::log.error "GitHub Token is missing! Please configure 'github_token' in the add-on configuration."
    exit 1
fi

# --- CLONE REPOSITORY ---
bashio::log.info "Cloning FluxID repository..."
# Construct URL with token
# Replace https:// with https://TOKEN@
CLONE_URL="${GITHUB_URL/https:\/\//https:\/\/$GITHUB_TOKEN@}"

cd /tmp || exit 1
rm -rf /tmp/src

if git clone --branch "$GITHUB_BRANCH" --depth 1 "$CLONE_URL" /tmp/src; then
    bashio::log.info "Repository cloned successfully."
else
    bashio::log.error "Failed to clone repository! Check your URL and Token."
    exit 1
fi

# --- BACKEND SETUP ---
bashio::log.info "Setting up Backend..."
mkdir -p /app/backend
cp -r /tmp/src/backend/* /app/backend/

# Install/Update Python Requirements
if [ -f "/app/backend/requirements.txt" ]; then
    bashio::log.info "Checking Python dependencies..."
    pip install --no-cache-dir -r /app/backend/requirements.txt
fi

# --- FRONTEND BUILD ---
bashio::log.info "Building Frontend..."
if [ -d "/tmp/src/frontend" ]; then
    mkdir -p /tmp/frontend_build
    cp -r /tmp/src/frontend/* /tmp/frontend_build/

    cd /tmp/frontend_build || exit 1

    # Fix API URL in frontend config if needed (assuming standard Vite env var or config)
    # FluxID frontend uses VITE_API_URL. We need to set it for the build or runtime.
    # In Vite, env vars are embedded at build time.
    # We want the frontend to talk to /api, which Nginx proxies to backend.
    # So VITE_API_URL should be /api or relative.
    export VITE_API_URL="/api"
    export VITE_APP_NAME="FluxID"

    bashio::log.info "Running npm install..."
    npm install

    bashio::log.info "Running npm run build..."
    if npm run build; then
        bashio::log.info "Frontend build successful."
        mkdir -p /app/frontend
        cp -r dist/* /app/frontend/
    else
        bashio::log.error "Frontend build failed!"
        exit 1
    fi
else
    bashio::log.error "Frontend directory not found in source!"
    exit 1
fi

# --- DATABASE SETUP ---
if [ ! -d "$DATA_DIR" ]; then
    bashio::log.info "Initializing PostgreSQL..."
    mkdir -p "$DATA_DIR"
    chown postgres:postgres "$DATA_DIR"
    su postgres -c "initdb -D $DATA_DIR"
fi

mkdir -p /run/postgresql
chown -R postgres:postgres /run/postgresql
chown -R postgres:postgres "$DATA_DIR"

bashio::log.info "Starting PostgreSQL..."
if ! su postgres -c "pg_ctl start -D $DATA_DIR -l /var/lib/postgresql/log.log"; then
    bashio::log.error "Failed to start PostgreSQL"
    exit 1
fi

bashio::log.info "Waiting for database..."
until su postgres -c "pg_isready"; do
    sleep 1
done

# Create DB User/DB if not exists
# Generate consistent password or use configured one?
# For Addon, simple is internal only normally, but we need it for Backend.
# We can generate a random password and store it, or regenerate on start and update backend env.
DB_PASS=$(tr -dc A-Za-z0-9 </dev/urandom | head -c 32)
bashio::log.info "Configuring Database..."
su postgres -c "createuser -s $DB_USER" || true
su postgres -c "createdb -O $DB_USER $DB_NAME" || true
echo "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS';" | su postgres -c "psql"

# --- START SERVICES ---
export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
export PORT=8000

# Apply custom environment variables
bashio::log.info "Applying custom environment variables..."
if bashio::config.has_value 'env_vars'; then
    for var in $(bashio::config 'env_vars'); do
        export "${var?}"
        bashio::log.info "Exported: ${var%%=*}"
    done
fi

bashio::log.info "Starting Backend..."
cd /app/backend || exit 1
uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

bashio::log.info "Starting Nginx..."
mkdir -p /run/nginx
nginx -g "daemon off;" &
NGINX_PID=$!

bashio::log.info "FluxID started!"

# Handle shutdown
cleanup() {
    bashio::log.info "Stopping..."
    kill -TERM $NGINX_PID 2>/dev/null
    kill -TERM $BACKEND_PID 2>/dev/null
    su postgres -c "pg_ctl stop -D $DATA_DIR -m smart" || true
    exit 0
}
trap cleanup SIGTERM SIGHUP

wait $NGINX_PID
