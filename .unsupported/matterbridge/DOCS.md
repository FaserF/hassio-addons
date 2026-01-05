# Matterbridge Documentation (Unsupported)

A simple chat bridge between different messanger apps.

> [!CAUTION]
> **UNSUPPORTED ADD-ON**
>
> This add-on is **no longer supported**. The upstream Matterbridge project has not been developed since **January 2023** and is considered abandoned. No support will be provided.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
config_path: /share/matterbridge/matterbridge.toml
log_level: info
```

## 📂 Folder Usage

- `/share`: Used to store the `matterbridge.toml` configuration file. This allows for easy editing of the configuration from outside the container.
- `/data`: Used internally by the add-on for persistent storage and session data.

## Support

> [!WARNING]
> **No Support Provided**
>
> Since Matterbridge has not been developed since January 2023, no support is available for this add-on.
