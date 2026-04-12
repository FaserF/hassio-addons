# Wiki.js Documentation

Wiki.js for Homeassistant OS

The most powerful and extensible open source Wiki software. Make documentation a joy to write using Wiki.js's beautiful and intuitive interface!

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
certfile: fullchain.pem
keyfile: privkey.pem
log_level: info
ssl: true
```

## 📂 Folder Usage

- `/ssl`: Used for SSL certificates (`certfile` and `keyfile`). Required if `ssl: true` is enabled.
- `/data`: Used for persistent storage of Wiki.js application files, local database, and configurations.
- `/config/git`: Used for storing Git SSH keys and local repository data. Persistent via `addon_config`.

## 🔗 Git Integration

This App supports Wiki.js Git storage for syncing your wiki content with a Git repository.

### Setup Steps

1. **Generate SSH Key** (optional, for SSH authentication):

   Supported key types: `id_rsa`, `id_ecdsa`, `id_ed25519`.

   Example (Ed25519):

   ```bash
   ssh-keygen -t ed25519 -f /config/git/ssh/id_ed25519 -N ""
   ```

   Example (RSA):

   ```bash
   ssh-keygen -t rsa -b 4096 -f /config/git/ssh/id_rsa -N ""
   ```

2. **Add Deploy Key** to your Git repository:
   - Copy the public key from `/config/git/ssh/id_rsa.pub`
   - Add it as a deploy key with write access in your repository settings

3. **Configure in Wiki.js**:
   - Go to Administration → Storage → Git
   - Enable Git storage
   - Set Repository URI (SSH format: `git@github.com:user/repo.git`)
   - Set SSH Private Key Path: `/config/git/ssh/id_ed25519` (or `id_rsa` / `id_ecdsa`)
   - Set Local Repository Path: `/config/git/repo`
   - Configure sync direction and schedule

### Folder Structure

- `/config/git/ssh/`: SSH keys for Git authentication
- `/config/git/repo/`: Local Git repository (managed by Wiki.js)

## Requirements

Please ensure that the MariaDB App is installed!

## Support

For issues and feature requests, please use the GitHub repository issues.
