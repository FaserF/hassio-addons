# Alivro

<img src="https://raw.githubusercontent.com/FaserF/hassio-addons/master/Alivro/logo.png" width="100" alt="Logo" />

[![Open your Home Assistant instance and show the app dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=605cee21_Alivro)
[![Home Assistant App](https://img.shields.io/badge/home%20assistant-app-blue.svg)](https://www.home-assistant.io/apps/)
[![Docker Image](https://img.shields.io/badge/docker-0.1.0-blue.svg?logo=docker&style=flat-square)](https://github.com/FaserF/hassio-addons/pkgs/container/hassio-addons-alivro)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Clinical AI-Powered Mental Health Companion for Depression, Burnout & Substance Harm Reduction.

---

> [!CAUTION]
> **Experimental / Beta Status**
>
> This App is still in development and/or primarily developed for personal use.
> It is not extensively testet yet, but is expected to work fundamentally.

---

## 📖 About

**Alivro** is a clinical AI-powered mental health companion designed to assist with depression, burnout, and substance harm reduction.

This Home Assistant add-on packages the complete Alivro application (FastAPI backend and modern React web frontend) with seamless Home Assistant Ingress integration and automated setup.

## 🚀 Key Features

- 🧠 **AI Mental Health Companion**: Context-aware guidance, check-ins, and evidence-based mental health support.
- 📊 **Real-time Dashboard & Ingress**: Integrated web interface accessible directly inside Home Assistant.
- 🔒 **Privacy & Data Security**: Full local data persistence with support for SQLite and PostgreSQL.
- ⚡ **Auto-Discovery & Integration**: Automatic companion integration management for Home Assistant.
- 🛠️ **Customizable AI Backends**: Native Google Gemini API integration with multi-model support.

---

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
ai_provider: gemini
database:
  type: sqlite
debug: false
default_locale: en
demo_mode: false
developer_mode: false
environment: production
github_repo: FaserF/Alivro
github_token: ''
log_level: info
project_name: Alivro
release_type: stable
reset_database: false
secret_key: ''
version: latest
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
