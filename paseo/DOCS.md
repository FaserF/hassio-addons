# Paseo Documentation

Autonomous AI Code Studio & Web IDE powered by OmniRoute and OpenCode, running natively inside Home Assistant OS.

## 📋 Features

- **Native Ingress Experience**: Fully integrated into the Home Assistant web interface and sidebar with zero VNC lag.
- **Home Assistant `/config` Workspace**: Automatically opens `/config` by default, giving you and your AI coding agents direct access to `configuration.yaml`, automations, scripts, and blueprints.
- **OmniRoute Integration**: Native connection to OmniRoute (`coding-cascade`, `fast-cascade`, `reasoning-latest`) for intelligent automation generation, refactoring, and bug fixing.
- **Remote Orchestration**: Optional port `6767` exposure allows controlling and steering the agent remotely from the central Oracle Cloud VM (`https://code.fabiseitz.de`), Hermes Telegram bot, or over Tailscale.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in Home Assistant.

### Example Configuration

```yaml
omniroute_url: 'https://omniroute.fabiseitz.de/v1'
omniroute_api_key: ''
model: 'omniroute/coding-cascade'
small_model: 'omniroute/fast-cascade'
workspace: '/config'
remote_access: true
log_level: 'info'
```

### Options

- `omniroute_url`: Base URL of the OmniRoute API proxy (e.g., `https://omniroute.fabiseitz.de/v1`).
- `omniroute_api_key`: API key for OmniRoute authentication.
- `model`: Primary model or cascade for complex coding, automation fixes, and refactoring (`omniroute/coding-cascade`).
- `small_model`: Fast model for rapid syntax checking and quick file edits (`omniroute/fast-cascade`).
- `workspace`: Root folder to open in the IDE (default `/config`).
- `developer_recommendations`: Pre-configure Paseo with the recommended multi-agent suite from the add-on developer (`supervisor`, `coder`, `reviewer`, `explorer`, `searcher`, `tester`, `security-auditor`, `browser-qa`, and all OmniRoute cascades). Default: `false`.
- `remote_access`: Enable direct port `6767` for external API and agent control.
- `max_memory_mb`: Maximum memory allocated to Paseo (default: `0` for dynamic auto-detection; safely reserves at least 1–1.5 GB for Home Assistant OS and Supervisor).
- `cpu_priority`: CPU scheduling priority (`low` [nice 10], `normal` [nice 0], `idle` [nice 19]) guaranteeing that Home Assistant Core automations never freeze.
- `log_level`: Add-on logging verbosity (`info`, `debug`, `warning`, `error`).

## 📂 Storage Mappings

- `/config`: Home Assistant configuration, automations, scripts, blueprints.
- `/share`: Shared storage for datasets and shared artifacts.
- `/ssl`: SSL certificates for secure communication.
- `/addons`: Local custom add-ons repository.
