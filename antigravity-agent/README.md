# Antigravity Agent

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/antigravity-agent/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_antigravity-agent)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-1.0.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-antigravity-agent)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Autonomous AI Coding Agent for Home Assistant using Google Antigravity & Gemini.

---

> [!CAUTION]
> **Experimental Status**
>
> This App is currently in active development. Please ensure you back up your GitHub repositories and only authorize the tokens with appropriate scopes.

---

## 📖 About

Antigravity Agent is a Home Assistant App designed to help developers automate software edits and PR submissions directly through Home Assistant triggers (e.g. chats, Telegram bots, or automations). 

It exposes a REST API that:
1. Translates user commands using `gemini-cli` to construct a perfect coding prompt.
2. Clones the target GitHub repository into a temporary workspace.
3. Automatically triggers the `antigravity` coding agent.
4. Commits changes and submits a Pull Request on GitHub.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
log_level: info
antigravity_token: 'your-antigravity-token'
gemini_token: 'your-gemini-token'
github_token: 'ghp_your_github_token'
default_instruction: 'Write changes to a new branch, verify them, and submit a pull request when done.'
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
