# Home Assistant App: Alivro

Clinical AI-Powered Mental Health Companion for Depression, Burnout & Substance Harm Reduction for Home Assistant.

## About

Alivro is a clinical AI-powered mental health companion designed to provide evidence-based support for depression, burnout, and substance harm reduction. This app packages the entire application (frontend dashboard and backend) into a single, easy-to-install Home Assistant App.

## Installation

1. Add this repository to your Home Assistant App store.
2. Install the "Alivro" app.
3. Configure the app (see configuration section below).
4. Start the app.
5. Access Alivro through the Home Assistant interface using Ingress.

## Configuration

### AI Configuration

**ai_provider**: AI service provider (default: `gemini`).
- Currently supports Google Gemini for reasoning and conversational analysis.

**gemini_api_key**: Google Gemini API key (optional).
- Required when using Gemini AI features. Get an API key from Google AI Studio.

**ai_model**: Specific AI model to use (optional).

### GitHub Access

**github_token**: GitHub Personal Access Token (optional, required if repo is private).
- Supports both **Classic** (`ghp_`) and **Fine-grained** (`github_pat_`) tokens.

**github_repo**: GitHub Repository (default: `FaserF/Alivro`).
- Repository to download from (format: `owner/repo`).

### Version Control

**version**: Version to install (default: `latest`).
- Use `latest` to automatically install the newest release.
- Specify a version tag like `v0.1.0` for a specific version.

**developer_mode**: Development mode (default: `false`).
- Downloads the latest code from the main branch on every restart.
- ⚠️ **Only for development**: May include unstable features!

### Database Configuration

**database.type**: Database backend (default: `sqlite`).
- `sqlite`: Simple embedded database (recommended for most users).
- `postgresql`: External PostgreSQL server (for advanced setups).

When using PostgreSQL, configure:
- **database.postgresql_host**: Database server hostname.
- **database.postgresql_port**: Database server port (default: `5432`).
- **database.postgresql_user**: Database username.
- **database.postgresql_password**: Database password.
- **database.postgresql_database**: Database name.

### Application Settings

**project_name**: Display name (default: `Alivro`).

**debug**: Debug mode (default: `false`).

**demo_mode**: Demo showcase mode with simulated data (default: `false`).

**secret_key**: Encryption key (optional).
- Leave empty to auto-generate a secure random key on first run.

**log_level**: Logging verbosity (default: `info`).

**default_locale**: Default language for the dashboard (default: `en`).

**first_admin_password**: Initial password for first admin user (optional, auto-generated if blank).

### Maintenance

**reset_database**: Reset all data (default: `false`).
- ⚠️ **DANGER**: This will DELETE ALL DATA!
- Requires `reset_database_confirm: true` to proceed.

## Example Configuration

### Basic Setup

```yaml
version: 'latest'
log_level: info
database:
  type: sqlite
project_name: 'Alivro'
debug: false
ai_provider: gemini
gemini_api_key: 'AIzaSy...'
```

## 🌐 Network & Home Assistant Auto-Discovery

This Add-on uses **`host_network: true`** by default.

- **Port Usage**: The web interface listens on port `8000` (HTTP) and the backend API on port `8001` (Internal Uvicorn).
- **Ingress**: Fully supported directly in the Home Assistant sidebar.

## 📂 Folder Usage

This app uses the following folders:

- `/data`: Used for persistent storage of Alivro application data, including:
  - `database/`: SQLite database storage.
  - `uploads/`: Uploaded files and attachments.
  - `plugins/`: Custom plugin extensions.
  - `.secret_key`: Auto-generated encryption key.
- `/share`: Mapped for general shared storage.

## Support

For issues and feature requests:
- [GitHub Issues (Add-on Repository)](https://github.com/FaserF/hassio-addons/issues)
- [Home Assistant Community Forum](https://community.home-assistant.io/)

## License

This project is licensed under the MIT License.
