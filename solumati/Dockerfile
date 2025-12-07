# Set a default value for local builds
ARG BUILD_FROM=ghcr.io/hassio-addons/base-python/amd64:14.0.0

# --- Stage 1: Frontend Build ---
FROM node:18-alpine AS builder

# Install Git
RUN apk add --no-cache git

WORKDIR /src

# 1. CLONE: Download source code
# Using depth 1 to speed up and avoid timeouts
RUN git clone --depth 1 https://github.com/FaserF/Solumati.git .

# 2. PATCH: Update Backend Dependencies for SQLite
# Replace Postgres dependency with internal SQLite by modifying requirements.txt
RUN sed -i '/psycopg2-binary/d' backend/requirements.txt
# NOTE: The database.py is updated to use "sqlite:///./solumati.db"

# --- Frontend Build ---
WORKDIR /src/frontend

# Install Node dependencies
RUN npm install

# Patch API URL for Ingress (Reverse Proxy)
RUN sed -i 's|http://localhost:7777|/api|g' src/config.js

# Build static assets
RUN npm run build

# --- Stage 2: Final Add-on Image ---
FROM $BUILD_FROM

# Install Nginx and runtime libraries ONLY.
# We no longer need libpq as we switched to SQLite.
RUN apk add --no-cache \
    nginx

WORKDIR /app

# 2. COPY BACKEND
# Get modified requirements from builder
COPY --from=builder /src/backend/requirements.txt .

# Install Python dependencies
# Now only installs general Python deps, no compilation tools needed.
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY --from=builder /src/backend /app

# 3. COPY FRONTEND
COPY --from=builder /src/frontend/dist /var/www/html

# Copy Nginx config
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy startup script
COPY run.sh /run.sh
RUN chmod +x /run.sh

ENV PYTHONUNBUFFERED=1

CMD [ "/run.sh" ]