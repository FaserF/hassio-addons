# Home Assistant Community Add-on: Vaultwarden (Bitwarden) (Custom)

> [!IMPORTANT]
> **Please prefer the official Vaultwarden add-on.**
> This add-on exists because Vaultwarden updates sometimes appear very slowly in the official repository.
> In this repository, updates are automatically triggered via Renovate, and if all CI tests pass, a new release is automatically published.
>
> Official Add-on: [hassio-addons/addon-bitwarden](https://github.com/hassio-addons/addon-bitwarden)

Add-on for Home Assistant that runs a Vaultwarden (Bitwarden) server.

## Comparison: Custom vs Official

| Feature | Custom Add-on | Official Add-on |
| :--- | :--- | :--- |
| **Base Image** | **Alpine Linux** | Debian |
| **Updates** | **Automated (Renovate)** | Manual |
| **Release Speed** | **Fast** (Automated) | Slower |
| **Size** | **Smaller** (Alpine) | Larger (Debian) |
| **Database Libs** | MariaDB, PostgreSQL, SQLite (apk) | MariaDB, PostgreSQL, SQLite (apt) |
| **Web Server** | Nginx (Alpine) | Nginx (Debian) |

## Documentation

Please read the [documentation](DOCS.md) for installation and configuration instructions.
