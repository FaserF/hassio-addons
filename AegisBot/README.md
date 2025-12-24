# AegisBot Home Assistant Add-on

![AegisBot Logo](icon.png)

Production-ready Telegram Moderation Bot with AI-driven FAQ and Security Features.

## Features

- 🛡️ **Advanced Moderation**: Automated warning, kick, and block system with RBAC
- 🧠 **AI Intent Analysis**: Heuristic engine detecting scams and malicious intent
- 🔄 **Real-time Dashboard**: WebSocket-driven live event stream
- 📈 **Sophisticated Analytics**: Interactive security trends and visualizations
- 🌍 **Full i18n**: Multi-language support (EN/DE)
- 🚫 **Intelligent Filtering**: Auto-learning blacklist suggestions

## Installation

See the [Documentation](DOCS.md) for detailed installation instructions.

## Quick Start

1. Add this repository to Home Assistant
1. Install the AegisBot add-on
1. Configure your Telegram Bot Token
1. Start the add-on
1. Access via Ingress

## Configuration

| Option                  | Required | Description                          |
|-------------------------|----------|--------------------------------------|
| `telegram_bot_token`    | ✅        | Bot API Token from @BotFather        |
| `telegram_bot_username` | ✅        | Bot username (without @)             |
| `github_token`          | ❌\*      | Required for private repo access     |
| `version`               | ❌        | Version to install (default: latest) |

\*Required if repository is private

## Support

- [GitHub Issues](https://github.com/FaserF/AegisBot/issues)
- [Documentation](DOCS.md)
