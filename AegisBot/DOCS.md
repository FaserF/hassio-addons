# Home Assistant Add-on: AegisBot

Production-ready Telegram Moderation Bot with AI-driven FAQ and Security Features
for Home Assistant.

## About

AegisBot is a comprehensive Telegram moderation bot that combines advanced antispam,
security scanning, and an AI-driven FAQ system based on group context. This add-on
packages the entire application (frontend dashboard and backend) into a single,
easy-to-install Home Assistant add-on.

## Installation

1. Add this repository to your Home Assistant add-on store
1. Install the "AegisBot" add-on
1. Configure the add-on (see configuration section below)
1. Start the add-on
1. Access AegisBot through the Home Assistant interface using Ingress

## Configuration

### Telegram Setup (Required)

**telegram_bot_token**: Telegram Bot API Token (required)

- Create a bot via [@BotFather](https://t.me/BotFather)
- Use `/newbot` and follow the prompts
- Copy the API token

**telegram_bot_username**: Telegram Bot Username (required)

- The username you set for your bot (without `@`)
- Configure domain via `/setdomain` in @BotFather for login widget

### GitHub Access

**github_token**: GitHub Personal Access Token (required for private repos)

- The AegisBot repository is currently **private**
- Supports both **Classic** (`ghp_`) and **Fine-grained** (`github_pat_`) tokens

#### How to Create a GitHub Token

##### Fine-grained Token (Recommended)

1. Visit: [https://github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
1. Configure:
   - **Token name**: `aegisbot-homeassistant-addon`
   - **Repository access**: Select "Only select repositories" → `FaserF/AegisBot`
   - **Permissions**: "Contents" → "Read-only"
1. Copy the token (starts with `github_pat_`)

##### Classic Token

1. Visit: [https://github.com/settings/tokens](https://github.com/settings/tokens)
1. Generate new token (classic)
1. Select scope: `repo` (Full control of private repositories)
1. Copy the token (starts with `ghp_`)

**github_repo**: GitHub Repository (default: `FaserF/AegisBot`)

- Repository to download from (format: `owner/repo`)

### Version Control

**version**: Version to install

- Use `latest` to automatically install the newest release
- Specify a version tag like `v1.0.0` for a specific version

**developer_mode**: Development mode (default: `false`)

- Downloads the latest code from main branch on every restart
- ⚠️ **Only for development**: May include unstable features!

### Database Configuration

**database.type**: Database backend (default: `sqlite`)

- `sqlite`: Simple embedded database (recommended for most users)
- `postgresql`: External PostgreSQL server (for advanced setups)

When using PostgreSQL, configure:

- **postgresql_host**: Database server hostname
- **postgresql_port**: Database server port (default: 5432)
- **postgresql_user**: Database username
- **postgresql_password**: Database password
- **postgresql_database**: Database name

### Application Settings

**project_name**: Display name (default: `AegisBot`)

**debug**: Debug mode (default: `false`)

**secret_key**: Encryption key (optional)

- Leave empty to auto-generate

### GitHub OAuth (Optional)

For dashboard authentication via GitHub:

- **github_client_id**: OAuth App Client ID
- **github_client_secret**: OAuth App Client Secret

### Advanced Options

**reset_database**: Reset all data (default: `false`)

- ⚠️ **DANGER**: This will DELETE ALL DATA!
- Action cannot be undone

**log_level**: Logging verbosity (default: `info`)

## Example Configuration

### Basic Setup

```yaml
version: "latest"
github_token: "ghp_your_github_token_here"
telegram_bot_token: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
telegram_bot_username: "YourBotName"
log_level: info
database:
  type: sqlite
project_name: "AegisBot"
debug: false
```

### Developer Mode

```yaml
version: "latest"
github_token: "ghp_your_github_token_here"
developer_mode: true
telegram_bot_token: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
telegram_bot_username: "YourBotName"
log_level: debug
database:
  type: sqlite
debug: true
```

## Support

For issues and feature requests:

- [GitHub Issues](https://github.com/FaserF/AegisBot/issues)
- [Home Assistant Community Forum](https://community.home-assistant.io/)

## License

This add-on uses the AegisBot project which is licensed under MIT.

## Authors

- Original AegisBot Project: FaserF
- Home Assistant Add-on: FaserF
