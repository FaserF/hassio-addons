#!/usr/bin/with-contenv bashio
# Git Support Setup for Wiki.js V3

GIT_DATA_DIR="/App_configs/wiki.js3/git"
GIT_SSH_DIR="$GIT_DATA_DIR/ssh"
GIT_REPO_DIR="$GIT_DATA_DIR/repo"

# Create directories for Git storage
bashio::log.info "Setting up Git support directories..."
mkdir -p "$GIT_SSH_DIR" "$GIT_REPO_DIR"
chmod 700 "$GIT_SSH_DIR"

# Configure SSH to use custom key location and permissions
# Support multiple key types: RSA, ECDSA, Ed25519
for key_type in id_rsa id_ecdsa id_ed25519; do
	if [ -f "$GIT_SSH_DIR/$key_type" ]; then
		bashio::log.info "Git SSH key found: $key_type"
		chmod 600 "$GIT_SSH_DIR/$key_type"
	fi
done

# Populate known_hosts to avoid first-connect errors
if [ ! -f "$GIT_SSH_DIR/known_hosts" ]; then
	bashio::log.info "Populating known_hosts for common git providers..."
	touch "$GIT_SSH_DIR/known_hosts"
	ssh-keyscan github.com gitlab.com bitbucket.org >>"$GIT_SSH_DIR/known_hosts" 2>/dev/null || true
	chmod 644 "$GIT_SSH_DIR/known_hosts"
fi

bashio::log.info "Git support enabled."
bashio::log.info "  SSH keys: $GIT_SSH_DIR"
bashio::log.info "  Repository: $GIT_REPO_DIR"
