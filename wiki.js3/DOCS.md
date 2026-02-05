# Wiki.js (Version 3 - Alpha) Documentation

Wiki.js (Version 3 - Alpha) for Homeassistant OS

The most powerful and extensible open source Wiki software. Make documentation a joy to write using Wiki.js's beautiful and intuitive interface!

**⚠️ Important:** This is the **Alpha** version of Wiki.js. Specifically, the upstream Wiki.js V3 is currently in Alpha stage by the developer. While this addon itself is functional, the underlying software is **NOT intended for production environments** yet. For stable production use, please use the [Wiki.js V2 addon](../wiki.js/DOCS.md).

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
- `/addon_configs`: Used for storing Git SSH keys and local repository data.

## 🔗 Git Integration

This addon supports Wiki.js Git storage for syncing your wiki content with a Git repository.

### Setup Steps

1. **Generate SSH Key** (optional, for SSH authentication):
   Supported key types: `id_rsa`, `id_ecdsa`, `id_ed25519`.

   Example (Ed25519):

   ```bash
   ssh-keygen -t ed25519 -f /addon_configs/wiki.js3/git/ssh/id_ed25519 -N ""
   ```

   Example (RSA):

   ```bash
   ssh-keygen -t rsa -b 4096 -f /addon_configs/wiki.js3/git/ssh/id_rsa -N ""
   ```

2. **Add Deploy Key** to your Git repository:
   - Copy the public key from `/addon_configs/wiki.js3/git/ssh/id_rsa.pub`
   - Add it as a deploy key with write access in your repository settings

3. **Configure in Wiki.js**:
   - Go to Administration → Storage → Git
   - Enable Git storage
   - Set Repository URI (SSH format: `git@github.com:user/repo.git`)
   - Set SSH Private Key Path: `/addon_configs/wiki.js3/git/ssh/id_ed25519` (or `id_rsa` / `id_ecdsa`)
   - Set Local Repository Path: `/addon_configs/wiki.js3/git/repo`
   - Configure sync direction and schedule

### Folder Structure

- `/addon_configs/wiki.js3/git/ssh/`: SSH keys for Git authentication
- `/addon_configs/wiki.js3/git/repo/`: Local Git repository (managed by Wiki.js)

## 🔄 Version Information

This addon automatically updates to the latest Wiki.js V3 Alpha releases. The addon version and Wiki.js version may differ - the addon version reflects the addon itself, while Wiki.js V3 is updated automatically from the official Docker image.

## Support

For issues and feature requests, please use the GitHub repository issues.
