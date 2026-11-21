# Home Assistant App: EntraMirror

Microsoft Entra ID Tenant Backup, Restore, Synchronization & Cloning for Home Assistant.

## About

EntraMirror provides secure backup, restoration, cloning, and disaster recovery for Microsoft Entra ID (Azure AD) tenants. It supports backing up Conditional Access Policies, Users, Groups, Enterprise Applications, App Registrations, Directory Roles, and Administrative Units.

This Home Assistant add-on packages the complete FastAPI backend, React frontend, and MkDocs documentation into an easy-to-use self-hosted container with Home Assistant Ingress support.

## Installation

1. Add this repository to your Home Assistant Add-on store.
2. Install the **EntraMirror** add-on.
3. Configure the add-on (provide `github_token` if accessing a private repo).
4. Start the add-on.
5. Open the Web UI via Home Assistant Ingress.

## Configuration

### GitHub Access (Private Repository Support)

- **github_token**: Personal Access Token (Classic `ghp_...` or Fine-grained `github_pat_...`) with repository read access.
- **github_repo**: Target repository (`FaserF/EntraMirror`).

### Application Modes

- **version**: `latest` or specific release tag (e.g. `v0.1.0`).
- **developer_mode**: `true` / `false`. When enabled, downloads and builds the latest code from `main` on every start.
- **sso_enabled**: Enable Entra ID single sign-on.
- **sso_client_id**: Application (Client) ID.
- **sso_tenant_id**: Tenant ID or `common`.

### Advanced Options

- **reset_database**: Reset database and stored snapshots/secrets (`false` by default).
- **reset_database_confirm**: Confirmation flag for database reset.
- **log_level**: Logging verbosity (`debug`, `info`, `warning`, `error`).
- **secret_key**: Custom encryption key or leave blank for auto-generation.

## Persistent Storage

- `/data/entramirror.db`: SQLite database.
- `/data/snapshots/`: Local backup snapshot archives.
- `/data/secrets/`: Encrypted credential storage.
- `/data/.secret_key`: Encryption master key.

## Support & Links

- **Repository**: [https://github.com/FaserF/EntraMirror](https://github.com/FaserF/EntraMirror)
- **Add-on Issues**: [https://github.com/FaserF/hassio-addons/issues](https://github.com/FaserF/hassio-addons/issues)
