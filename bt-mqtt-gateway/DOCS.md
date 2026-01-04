# bt-mqtt-gateway Documentation

Bluetooth MQTT Gateway Server (Unsupported)

> [!WARNING]
> **This add-on is no longer supported.**
> The original repository (wealth/bt-mqtt-gateway) was archived in October 2023.
>
> **Recommended Alternatives for 2025:**
>
> * **OpenMQTTGateway**: Supports ESP32/ESP8266 devices.
> * **Theengs Gateway**: Ideal for Raspberry Pi or existing Linux hosts.
> * **ESPHome Bluetooth Proxy**: Good for Home Assistant native integration (note: may not publish raw MQTT as freely as the others).

This can be used, to improve the reliability of bluetooth thermostats. See <https://github.com/home-assistant/core/issues/28601> for more information.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
config_path: /share/bt-mqtt-gateway.yaml
debug: false
```

## 📂 Folder Usage

- `/share`: Used to store the configuration file `bt-mqtt-gateway.yaml`. This allows you to easily edit the configuration from outside the add-on container.
- `/data`: Used internally by the add-on for persistent storage.

## Requirements

Please make sure that a MQTT Addon is being installed already.

## Support

For issues and feature requests, please use the GitHub repository issues.
