#!/usr/bin/with-contenv bashio
# shellcheck shell=bash

# Enable strict mode
set -e
# shellcheck disable=SC1091
bashio::addon.print_banner
# Get Addon Version

# --- CONFIGURATION ---
DATA_DIR="/data/aegisbot"
DB_DIR="$DATA_DIR/database"
PLUGINS_DIR="$DATA_DIR/plugins"
UPLOADS_DIR="$DATA_DIR/uploads"

bashio::log.info "Starting AegisBot Add-on initialization..."

# --- FACTORY RESET CHECK (DANGEROUS!) ---
if bashio::config.true 'reset_database'; then
	bashio::log.warning "=================================================="
	bashio::log.warning "   ⚠️  DATABASE RESET ENABLED  ⚠️"
	bashio::log.warning "=================================================="
	bashio::log.warning "ALL DATA WILL BE PERMANENTLY DELETED!"
	bashio::log.warning "This includes:"
	bashio::log.warning "  - All user accounts and settings"
	bashio::log.warning "  - All moderation logs and history"
	bashio::log.warning "  - All blacklist entries"
	bashio::log.warning "  - All uploaded files"
	bashio::log.warning "=================================================="

	# Wait 5 seconds to give user time to cancel
	bashio::log.warning "Starting reset in 5 seconds... (Stop add-on NOW to abort)"
	sleep 5

	bashio::log.info "Proceeding with database reset..."

	# Delete all data
	if [ -d "$DATA_DIR" ]; then
		bashio::log.info "Deleting all data..."
		rm -rf "$DATA_DIR"
	fi

	bashio::log.info "=================================================="
	bashio::log.info "   ✅ DATABASE RESET COMPLETE"
	bashio::log.info "=================================================="
	bashio::log.info "All data has been deleted."
	bashio::log.info "The add-on will now restart with a fresh database."
	bashio::log.info ""
	bashio::log.warning "IMPORTANT: Disable 'reset_database' in the add-on settings!"
	bashio::log.warning "Otherwise, the database will be wiped again on next restart."
	bashio::log.info "=================================================="
fi

# --- CREATE DATA DIRECTORIES ---
mkdir -p "$DB_DIR"
mkdir -p "$PLUGINS_DIR"
mkdir -p "$UPLOADS_DIR"

# --- READ CONFIGURATION FROM HA UI ---
bashio::log.info "Reading configuration from Home Assistant..."

# Version
VERSION=$(bashio::config 'version')
bashio::log.info "Target Version: $VERSION"

# Log Level
if bashio::config.has_value 'log_level'; then
	LOG_LEVEL=$(bashio::config 'log_level')
	LOG_LEVEL=$(echo "$LOG_LEVEL" | tr '[:lower:]' '[:upper:]')
	case "$LOG_LEVEL" in
	TRACE | DEBUG) LOG_LEVEL="DEBUG" ;;
	NOTICE | INFO) LOG_LEVEL="INFO" ;;
	WARNING) LOG_LEVEL="WARNING" ;;
	ERROR | FATAL) LOG_LEVEL="ERROR" ;;
	*) LOG_LEVEL="INFO" ;;
	esac
	export LOG_LEVEL
	bashio::log.info "Log level set to: $LOG_LEVEL"
fi

# Database Configuration
DB_TYPE=$(bashio::config 'database.type')

if [[ "$DB_TYPE" == "postgresql" ]]; then
	PG_HOST=$(bashio::config 'database.postgresql_host')
	PG_PORT=$(bashio::config 'database.postgresql_port')
	PG_USER=$(bashio::config 'database.postgresql_user')
	PG_PASS=$(bashio::config 'database.postgresql_password')
	PG_DB=$(bashio::config 'database.postgresql_database')

	export DATABASE_URL="postgresql://$PG_USER:$PG_PASS@$PG_HOST:$PG_PORT/$PG_DB"
	bashio::log.info "Using PostgreSQL database at $PG_HOST:$PG_PORT"
else
	export DATABASE_URL="sqlite:///$DB_DIR/aegisbot.db"
	bashio::log.info "Using SQLite database"
fi

# Secret Key
if bashio::config.has_value 'secret_key' && [ -n "$(bashio::config 'secret_key')" ]; then
	SECRET_KEY=$(bashio::config 'secret_key')
	export SECRET_KEY
	bashio::log.info "Using configured secret key"
else
	# Generate or load secret key
	if [ ! -f "$DATA_DIR/.secret_key" ]; then
		bashio::log.info "Generating secret key..."
		python3 -c 'import secrets; print(secrets.token_urlsafe(32))' >"$DATA_DIR/.secret_key"
	fi
	SECRET_KEY=$(cat "$DATA_DIR/.secret_key")
	export SECRET_KEY
	bashio::log.info "Using auto-generated secret key"
fi

# Project Name
PROJECT_NAME=$(bashio::config 'project_name')
export PROJECT_NAME

# Debug Mode
if bashio::config.true 'debug'; then
	export DEBUG="true"
	bashio::log.info "Debug mode: ENABLED"
else
	export DEBUG="false"
fi

# Demo Mode
if bashio::config.true 'demo_mode'; then
	export DEMO_MODE="True"
	bashio::log.info "Demo mode: ENABLED"
else
	export DEMO_MODE="False"
fi

# Demo Mode Type
if bashio::config.has_value 'demo_mode_type'; then
	DEMO_MODE_TYPE=$(bashio::config 'demo_mode_type')
	export DEMO_MODE_TYPE
	bashio::log.info "Demo mode type: $DEMO_MODE_TYPE"
else
	export DEMO_MODE_TYPE="ephemeral"
fi

# GitHub OAuth (Optional) - Removed from Env, driven by DB/UI now
bashio::log.info "Note: Authentication settings are now configured via Web UI."

# GitHub Repo Configuration
if bashio::config.has_value 'github_repo' && [ -n "$(bashio::config 'github_repo')" ]; then
	GITHUB_REPO=$(bashio::config 'github_repo')
	export GITHUB_REPO
	bashio::log.info "GitHub Repo set to: $GITHUB_REPO"
else
	export GITHUB_REPO="FaserF/AegisBot"
	bashio::log.info "Using default GitHub Repo: $GITHUB_REPO"
fi

# Version Information
export BACKEND_VERSION="${BUILD_VERSION:-dev}"

# --- HELPER FUNCTIONS FOR DOWNLOAD ---

# Helper to construct Auth Header if token exists
get_auth_header() {
	local token="$1"
	if [[ -z "$token" ]]; then
		echo ""
	elif [[ "$token" == github_pat_* ]]; then
		echo "Authorization: Bearer $token"
	elif [[ "$token" == ghp_* ]]; then
		echo "Authorization: token $token"
	else
		echo "Authorization: Bearer $token"
	fi
}

# Helper to download with fallback logic
download_file() {
	local url="$1"
	local output="$2"
	local token="$3"

	bashio::log.info "Attempting download from: $url"

	# 1. Try Public Access (No Token)
	bashio::log.debug "Trying public access..."
	# -f fails silently on server errors (404/403)
	if curl -L -f -H "Accept: application/vnd.github.v3+json" "$url" -o "$output" 2>/dev/null; then
		bashio::log.info "✅ Public download successful."
		return 0
	fi

	# 2. If failed, check if we have a token and try with it
	bashio::log.info "Public access failed. Checking for token..."

	if [ -n "$token" ]; then
		local auth_header
		auth_header=$(get_auth_header "$token")
		bashio::log.info "Token found (length: ${#token}). Retrying with authentication..."
		bashio::log.debug "Auth header format: ${auth_header:0:20}..."

		# Try API endpoint first - show more error info
		local http_code
		http_code=$(curl -L -w "%{http_code}" -H "$auth_header" -H "Accept: application/vnd.github.v3+json" "$url" -o "$output" 2>/dev/null)
		if [ "$http_code" = "200" ]; then
			bashio::log.info "✅ Authenticated download successful."
			return 0
		fi
		bashio::log.warning "API download returned HTTP $http_code"

		# Try alternative: Direct GitHub archive URL (works better for some private repos)
		# Convert API URL to direct archive URL
		# From: https://api.github.com/repos/OWNER/REPO/tarball/REF
		# To:   https://github.com/OWNER/REPO/archive/REF.tar.gz
		local direct_url
		direct_url=$(echo "$url" | sed 's|api.github.com/repos/|github.com/|' | sed 's|/tarball/|/archive/|')
		direct_url="${direct_url}.tar.gz"
		bashio::log.info "Trying direct archive URL: $direct_url"

		http_code=$(curl -L -w "%{http_code}" -H "$auth_header" "$direct_url" -o "$output" 2>/dev/null)
		if [ "$http_code" = "200" ]; then
			bashio::log.info "✅ Direct archive download successful."
			return 0
		fi
		bashio::log.warning "Direct download returned HTTP $http_code"

		bashio::log.error "❌ Download failed even with token."
		bashio::log.error "Please ensure your token has 'repo' scope for private repositories."
		return 1
	else
		bashio::log.error "❌ Public access failed and no 'github_token' is configured."
		bashio::log.error "If this is a private repository, please add a token in the configuration."
		return 1
	fi
}

# --- INITIAL CODE DOWNLOAD ---
# Check if code has been downloaded yet
if [ ! -f "/app/backend/app/main.py" ] || [ ! -f "/app/frontend/index.html" ]; then
	bashio::log.info "==================================================="
	bashio::log.info "   📦 INITIAL CODE DOWNLOAD REQUIRED"
	bashio::log.info "==================================================="
	bashio::log.info "This is the first start or code is missing."
	bashio::log.info "Attempting to download AegisBot core..."

	# Get GitHub Token from config (optional)
	GITHUB_TOKEN=""
	if bashio::config.has_value 'github_token' && [ -n "$(bashio::config 'github_token')" ]; then
		GITHUB_TOKEN=$(bashio::config 'github_token')
		bashio::log.debug "GitHub Token is configured."
	else
		bashio::log.debug "No GitHub Token configured."
	fi

	# Determine version to download
	DOWNLOAD_VERSION="$VERSION"

	# Get GitHub Repo from config or use default
	GITHUB_REPO_CONFIG="${GITHUB_REPO:-FaserF/AegisBot}"
	GITHUB_REPO_CONFIG="${GITHUB_REPO:-FaserF/AegisBot}"
	# REPO_OWNER=$(echo "$GITHUB_REPO_CONFIG" | cut -d'/' -f1)
	# REPO_NAME=$(echo "$GITHUB_REPO_CONFIG" | cut -d'/' -f2)

	if [ "$DOWNLOAD_VERSION" == "latest" ]; then
		bashio::log.info "Fetching latest release information for $GITHUB_REPO_CONFIG..."

		# We need to fetch the tag name. Logic similar to download: try public, then private.
		LATEST_RELEASE_TAG=""

		# Use temp file to avoid subshell exit code issues with set -e
		# 1. Try Public API
		bashio::log.info "1. Trying public GitHub API..."
		if curl -s -f -o /tmp/latest_release.json "https://api.github.com/repos/${GITHUB_REPO_CONFIG}/releases/latest"; then
			# Extract tag
			bashio::log.info "✅ Public API request successful."
			LATEST_RELEASE_TAG=$(grep '"tag_name":' /tmp/latest_release.json | sed -E 's/.*"tag_name": "([^"]+)".*/\1/')
		else
			# 2. Try with Token if available
			bashio::log.info "⚠️ Public API request failed (likely 404/403 or private repo)."
			if [ -n "$GITHUB_TOKEN" ]; then
				bashio::log.info "2. Retrying with provided GitHub Token..."
				AUTH_HEADER=$(get_auth_header "$GITHUB_TOKEN")
				if curl -s -f -H "$AUTH_HEADER" -o /tmp/latest_release.json "https://api.github.com/repos/${GITHUB_REPO_CONFIG}/releases/latest"; then
					bashio::log.info "✅ Authenticated API request successful."
					LATEST_RELEASE_TAG=$(grep '"tag_name":' /tmp/latest_release.json | sed -E 's/.*"tag_name": "([^"]+)".*/\1/')
				else
					bashio::log.warning "❌ Authenticated API request also failed. Please check your token."
				fi
			else
				bashio::log.info "No GitHub Token configured to retry with."
			fi
		fi

		# Cleanup temp file
		rm -f /tmp/latest_release.json

		if [ -n "$LATEST_RELEASE_TAG" ]; then
			DOWNLOAD_VERSION="$LATEST_RELEASE_TAG"
			bashio::log.info "👉 Latest release identified: $DOWNLOAD_VERSION"
		else
			bashio::log.warning "⚠️ Could not identify latest release (or access denied)."
			bashio::log.warning "👉 Defaulting to 'main' branch as fallback."
			DOWNLOAD_VERSION="main"
		fi
	fi

	# Prepare Download URL
	if [ "$DOWNLOAD_VERSION" == "main" ]; then
		DOWNLOAD_URL="https://api.github.com/repos/${GITHUB_REPO_CONFIG}/tarball/main"
	else
		DOWNLOAD_URL="https://api.github.com/repos/${GITHUB_REPO_CONFIG}/tarball/$DOWNLOAD_VERSION"
	fi

	bashio::log.info "Downloading version: $DOWNLOAD_VERSION"

	# Download
	cd /tmp || exit 1
	if download_file "$DOWNLOAD_URL" "aegisbot.tar.gz" "$GITHUB_TOKEN"; then
		bashio::log.info "Extracting archive..."
		rm -rf /tmp/aegisbot-src
		mkdir -p /tmp/aegisbot-src
		tar -xzf aegisbot.tar.gz -C /tmp/aegisbot-src --strip-components=1

		# Install Backend
		bashio::log.info "Installing Backend..."
		if [ -d "/tmp/aegisbot-src/backend" ]; then
			cp -r /tmp/aegisbot-src/backend/* /app/backend/

			if [ -f "/app/backend/requirements.txt" ]; then
				bashio::log.info "Installing Python dependencies from requirements.txt..."
				pip3 install --no-cache-dir -r /app/backend/requirements.txt ||
					bashio::log.warning "Some Python dependencies failed to install"
			fi
		else
			bashio::log.error "Backend directory not found in repository!"
			exit 1
		fi

		# Build Frontend
		bashio::log.info "Building Frontend (this may take several minutes)..."
		if [ -d "/tmp/aegisbot-src/frontend" ]; then
			cd /tmp/aegisbot-src/frontend || exit 1

			bashio::log.info "Running 'npm install'..."
			if npm install; then
				bashio::log.info "Configuring relative paths for Ingress..."
				sed -i "s|defineConfig({|defineConfig({ base: './',|g" vite.config.ts
				sed -i "s|const API_BASE = '.*'|const API_BASE = './api/v1'|g" src/api/client.ts
				bashio::log.info "Running 'npm run build'..."
				if npm run build; then
					bashio::log.info "Frontend build successful. Installing..."
					if [ -d "dist" ]; then
						cp -r dist/* /app/frontend/
					else
						bashio::log.error "'dist' directory not found after build!"
						exit 1
					fi
				else
					bashio::log.error "Frontend build failed!"
					exit 1
				fi
			else
				bashio::log.error "npm install failed!"
				exit 1
			fi
		else
			bashio::log.error "Frontend directory not found in repository!"
			exit 1
		fi

		# Cleanup
		cd / || exit 1
		rm -rf /tmp/aegisbot.tar.gz /tmp/aegisbot-src

		bashio::log.info "==================================================="
		bashio::log.info "   ✅ CODE DOWNLOAD COMPLETE"
		bashio::log.info "==================================================="
		# Mark that we just did initial download - skip developer_mode re-download
		INITIAL_DOWNLOAD_DONE="true"
	else
		bashio::log.error "Download failed! Please check your network or token settings."
		# If a specific version was requested and failed, try falling back to main branch
		if [ "$VERSION" != "latest" ] && [ "$VERSION" != "main" ]; then
			bashio::log.warning "⚠️ Requested version '$VERSION' not available."
			bashio::log.warning "👉 Falling back to 'main' branch..."
			DOWNLOAD_URL="https://api.github.com/repos/${GITHUB_REPO_CONFIG}/tarball/main"
			if download_file "$DOWNLOAD_URL" "aegisbot.tar.gz" "$GITHUB_TOKEN"; then
				bashio::log.info "✅ Fallback to main branch successful."
				# Continue with extraction and build (same as above)
				bashio::log.info "Extracting archive..."
				rm -rf /tmp/aegisbot-src
				mkdir -p /tmp/aegisbot-src
				tar -xzf aegisbot.tar.gz -C /tmp/aegisbot-src --strip-components=1

				# Install Backend
				bashio::log.info "Installing Backend..."
				if [ -d "/tmp/aegisbot-src/backend" ]; then
					cp -r /tmp/aegisbot-src/backend/* /app/backend/

					if [ -f "/app/backend/requirements.txt" ]; then
						bashio::log.info "Installing Python dependencies from requirements.txt..."
						pip3 install --no-cache-dir -r /app/backend/requirements.txt ||
							bashio::log.warning "Some Python dependencies failed to install"
					fi
				else
					bashio::log.error "Backend directory not found in repository!"
					exit 1
				fi

				# Build Frontend
				bashio::log.info "Building Frontend (this may take several minutes)..."
				if [ -d "/tmp/aegisbot-src/frontend" ]; then
					cd /tmp/aegisbot-src/frontend || exit 1

					bashio::log.info "Running 'npm install'..."
					if npm install; then
						bashio::log.info "Configuring relative paths for Ingress..."
						sed -i "s|defineConfig({|defineConfig({ base: './',|g" vite.config.ts
						sed -i "s|const API_BASE = '.*'|const API_BASE = './api/v1'|g" src/api/client.ts
						bashio::log.info "Running 'npm run build'..."
						if npm run build; then
							bashio::log.info "Frontend build successful. Installing..."
							if [ -d "dist" ]; then
								cp -r dist/* /app/frontend/
							else
								bashio::log.error "'dist' directory not found after build!"
								exit 1
							fi
						else
							bashio::log.error "Frontend build failed!"
							exit 1
						fi
					else
						bashio::log.error "npm install failed!"
						exit 1
					fi
				else
					bashio::log.error "Frontend directory not found in repository!"
					exit 1
				fi

				# Cleanup
				cd / || exit 1
				rm -rf /tmp/aegisbot.tar.gz /tmp/aegisbot-src

				bashio::log.info "==================================================="
				bashio::log.info "   ✅ CODE DOWNLOAD COMPLETE (MAIN BRANCH)"
				bashio::log.info "==================================================="
				# Mark that we just did initial download - skip developer_mode re-download
				INITIAL_DOWNLOAD_DONE="true"
			else
				bashio::log.error "❌ Fallback to main branch also failed!"
				exit 1
			fi
		else
			exit 1
		fi
	fi
fi

# --- DEV MODE: USE MAIN BRANCH ---
# Skip if we just did initial download (to avoid downloading twice)
if bashio::config.true 'developer_mode' && [ "${INITIAL_DOWNLOAD_DONE:-false}" != "true" ]; then
	bashio::log.warning "=================================================="
	bashio::log.warning "   ⚠️  DEVELOPER MODE ENABLED  ⚠️"
	bashio::log.warning "=================================================="
	bashio::log.warning "Using latest code from 'main' branch."
	bashio::log.warning "Downloading and rebuilding..."

	# Get GitHub Token (Optional)
	GITHUB_TOKEN=""
	if bashio::config.has_value 'github_token' && [ -n "$(bashio::config 'github_token')" ]; then
		GITHUB_TOKEN=$(bashio::config 'github_token')
	fi

	# Download main branch with fallback
	cd /tmp || exit 1
	GITHUB_REPO_CONFIG="${GITHUB_REPO:-FaserF/AegisBot}"
	DOWNLOAD_URL="https://api.github.com/repos/${GITHUB_REPO_CONFIG}/tarball/main"

	if download_file "$DOWNLOAD_URL" "main.tar.gz" "$GITHUB_TOKEN"; then
		bashio::log.info "Extracting..."
		rm -rf /tmp/aegisbot-main
		mkdir -p /tmp/aegisbot-main
		tar -xzf main.tar.gz -C /tmp/aegisbot-main --strip-components=1

		# Update Backend
		bashio::log.info "Updating Backend code..."
		if [ -d "/tmp/aegisbot-main/backend" ]; then
			cp -r /tmp/aegisbot-main/backend/* /app/backend/

			# Install potentially new python requirements
			if [ -f "/app/backend/requirements.txt" ]; then
				bashio::log.info "Installing Python dependencies..."
				pip3 install --no-cache-dir -r /app/backend/requirements.txt
			fi
		else
			bashio::log.error "Backend directory not found in main branch!"
		fi

		# Rebuild Frontend
		bashio::log.info "Rebuilding Frontend..."
		if [ -d "/tmp/aegisbot-main/frontend" ]; then
			# Create temp build dir
			rm -rf /tmp/frontend_build
			mkdir -p /tmp/frontend_build
			cp -r /tmp/aegisbot-main/frontend/* /tmp/frontend_build/

			cd /tmp/frontend_build || exit 1

			bashio::log.info "Running 'npm install'..."
			if npm install; then
				bashio::log.info "Configuring relative paths for Ingress..."
				sed -i "s|defineConfig({|defineConfig({ base: './',|g" vite.config.ts
				sed -i "s|const API_BASE = '.*'|const API_BASE = './api/v1'|g" src/api/client.ts
				bashio::log.info "Running 'npm run build'..."
				if npm run build; then
					bashio::log.info "Frontend build successful. Updating files..."
					# Remove old frontend files
					rm -rf /app/frontend/*
					if [ -d "dist" ]; then
						cp -r dist/* /app/frontend/
					else
						bashio::log.error "'dist' directory not found after build!"
					fi
				else
					bashio::log.error "Frontend build failed! Keeping old frontend."
				fi
			else
				bashio::log.error "npm install failed! Keeping old frontend."
			fi
		else
			bashio::log.error "Frontend directory not found in main branch!"
		fi

		# Cleanup
		rm -rf /tmp/main.tar.gz /tmp/aegisbot-main /tmp/frontend_build
		cd / || exit 1

		bashio::log.info "=================================================="
		bashio::log.info "   ✅ DEV MODE UPDATE COMPLETE"
		bashio::log.info "=================================================="
	else
		bashio::log.error "Failed to download main branch from GitHub!"
	fi
else
	bashio::log.info "Production Mode: Using existing/packaged version."
fi

# --- SETUP SYMLINKS FOR PERSISTENCE ---
bashio::log.info "Setting up persistent storage..."

# Link uploads directory
mkdir -p /app/backend/static
rm -rf /app/backend/static/uploads
ln -s "$UPLOADS_DIR" /app/backend/static/uploads

# Link plugins directory
rm -rf /app/plugins
ln -s "$PLUGINS_DIR" /app/plugins

# --- DATABASE MIGRATIONS ---
if [ -f "/app/backend/alembic.ini" ]; then
	bashio::log.info "Running database migrations..."
	cd /app/backend || exit 1
	alembic upgrade head || bashio::log.warning "Migration failed or not needed, continuing..."
fi

# --- CREATE .ENV FILE FOR BACKEND ---
bashio::log.info "Creating .env file for backend..."
cat >/app/backend/.env <<EOF
SECRET_KEY=${SECRET_KEY}
DATABASE_URL=${DATABASE_URL}
DEBUG=${DEBUG}
DEMO_MODE=${DEMO_MODE}
DEMO_MODE_TYPE=${DEMO_MODE_TYPE}
EOF

# --- BACKEND START ---
bashio::log.info "Starting AegisBot Backend (Uvicorn)..."
bashio::log.info "Environment: DEBUG=$DEBUG, LOG_LEVEL=${LOG_LEVEL:-INFO}"
cd /app/backend || exit 1

# Set Python path
export PYTHONPATH=/app/backend

# Start Uvicorn in background
uvicorn app.main:app --host 127.0.0.1 --port 8001 --log-level "$(echo "$LOG_LEVEL" | tr '[:upper:]' '[:lower:]')" &
BACKEND_PID=$!

# --- NGINX START ---
bashio::log.info "Starting Nginx (Frontend)..."
mkdir -p /run/nginx
nginx -g "daemon off;" &
NGINX_PID=$!

bashio::log.info "AegisBot is now running!"
bashio::log.info "Access via Home Assistant Ingress"

# Trap signals to stop processes correctly
cleanup() {
	bashio::log.info "Shutting down services..."

	# Stop Nginx gracefully
	kill -TERM $NGINX_PID 2>/dev/null
	wait $NGINX_PID 2>/dev/null

	# Stop Backend gracefully
	kill -TERM $BACKEND_PID 2>/dev/null
	wait $BACKEND_PID 2>/dev/null

	bashio::log.info "All services stopped"
	exit 0
}

trap cleanup SIGTERM SIGHUP

wait $NGINX_PID
