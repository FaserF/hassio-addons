# OpenSSL

![Logo](logo.png)

[![Open your Home Assistant instance and show the add-on dashboard.](https://my.home-assistant.io/badges/supervisor_addon.svg)](https://my.home-assistant.io/redirect/supervisor_addon/?addon=c1e285b7_openssl)
[![Home Assistant Add-on](https://img.shields.io/badge/home%20assistant-addon-blue.svg)](https://www.home-assistant.io/addons/)
[![GitHub Release](https://img.shields.io/github/v/release/FaserF/hassio-addons?include_prereleases&style=flat-square)](https://github.com/FaserF/hassio-addons/releases)
![Project Maintenance](https://img.shields.io/badge/maintainer-FaserF-blue?style=flat-square)

> Generate self-signed certificates

---

## 📖 About

OpenSSL - Self signed certificates for Homeassistant OS


OpenSSL is a software library for applications that secure communications over
computer networks against eavesdropping or need to identify the party at the
other end. It is widely used by Internet servers, including the majority of
HTTPS websites.

OpenSSL contains an open-source implementation of the SSL and TLS protocols.
The core library, written in the C programming language, implements basic
cryptographic functions and provides various utility functions. Wrappers
allowing the use of the OpenSSL library in a variety of computer languages are
available.

The OpenSSL Software Foundation (OSF) represents the OpenSSL project in most
legal capacities including contributor license agreements, managing donations,
and so on. OpenSSL Software Services (OSS) also represents the OpenSSL project,
for Support Contracts.

## Installation


The installation of this add-on is pretty straightforward and not different in
comparison to installing any other custom Home Assistant add-on.

Just click the link above or add my repo to the hassio addons repositorys: <https://github.com/FaserF/hassio-addons>

After starting the addon, a self signed certificate will be created and placed to:
/ssl/key_openssl.pem
/ssl/cert_openssl.pem

These can then be used by other addons, for example my apache2 webserver addon.
If the certificates are about to expire, just restart the addone once and new
certificates will be created.
WARNING: After restarting the addon, old certificates named as above will be
deleted and overwritten!

---

## ⚙️ Configuration

Add the following to your `config.yaml` or configure via the UI:

```yaml
website_name: null
```

---

## 👨‍💻 Credits & License

This project is open-source and available under the MIT License.
Maintained by **FaserF**.
