# Tado Auto Assist Documentation

Tado Auto-Assist for Geofencing and Open Window Detection for Home Assistant OS

A Python script that automatically adjusts the temperature in your home based on your presence
(arriving or leaving), using your settings from the Tado app. It also switches off the heating
(activates Open Window Mode) in any room where a Tado TRV detects an open window.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
log_level: info
maxTemp: 25
minTemp: 5
password: ''
username: ''
```

## 📂 Folder Usage

- `/data`: Used internally by the add-on for persistent meta-data storage and session information.

## Support

For issues and feature requests, please use the GitHub repository issues.
