#!/usr/bin/with-contenv bashio

# Git Support Setup for Wiki.js V3

GIT_DATA_DIR="/addon_configs/wiki.js3/git"
GIT_SSH_DIR="$GIT_DATA_DIR/ssh"
GIT_REPO_DIR="$GIT_DATA_DIR/repo"

# Create directories for Git storage
bashio::log.info "Setting up Git support directories..."
mkdir -p "$GIT_SSH_DIR" "$GIT_REPO_DIR"
chmod 700 "$GIT_SSH_DIR"

# Configure SSH to use custom key location
if [ -f "$GIT_SSH_DIR/id_rsa" ]; then
    bashio::log.info "Git SSH key found at $GIT_SSH_DIR/id_rsa"
    # Set permissions for SSH key
    chmod 600 "$GIT_SSH_DIR/id_rsa"
fi

bashio::log.info "Git support enabled."
bashio::log.info "  SSH keys: $GIT_SSH_DIR"
bashio::log.info "  Repository: $GIT_REPO_DIR"
