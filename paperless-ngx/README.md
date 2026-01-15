# Home Assistant Add-on: Paperless-ngx

Scan, index, and archive all of your physical documents.

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armv7 Architecture][armv7-shield]

## About

[Paperless-ngx][paperless-ngx] is a community-supported open-source document management system that transforms your physical documents into a searchable online archive so you can keep less paper.

This add-on brings Paperless-ngx to Home Assistant OS, fully integrated with Ingress and running on a lightweight Alpine Linux base.

## Features

- **Ingress Support**: Access Paperless directly from your Home Assistant dashboard.
- **Renovate Monitoring**: Kept up-to-date automatically.
- **OCR Support**: Built-in OCR for German and English (configurable).
- **Architecture**: Supports aarch64, amd64, and armv7.

## Installation

1. Add this repository to your Home Assistant Add-on Store.
2. Install the **Paperless-ngx** add-on.
3. Configure your preferences in the `Configuration` tab (Time Zone, OCR Language, Admin User).
4. Start the add-on.

## Configuration

**Note**: The add-on creates a default admin user on first start if one does not exist.

### Option: `admin_user`

The username for the initial superuser. Default: `admin`.

### Option: `admin_password`

The password for the initial superuser. Default: `password`.

### Option: `ocr_language`

The default language for OCR. Default: `deu` (German). You can also use `eng` (English).

## Support

Got questions?
You can open an issue here on GitHub.

[paperless-ngx]: https://github.com/paperless-ngx/paperless-ngx
[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
