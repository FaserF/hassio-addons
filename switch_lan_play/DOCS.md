# Switch LAN Play Client Documentation

Nintendo Switch LAN-Play Client for Homeassistant OS

To play with your CFW Nintendo Switch online, you can use this App + a public or private Server. This App can be used, to stop running the lan play client on a Desktop PC/Laptop.

This is just the Client Software and NOT the Server Software. To use a lan-play server with Homeassistant OS, please have a look at my other App: [switch_lan_play_server](https://github.com/FaserF/hassio-addons/switch_lan_play_server)

This docker image will self-compile the latest lan-play software and run it based on your architecture. More information can be found here: <https://drive.google.com/file/d/1A_4o8HCAfDBFsePcGL3utG-LfzMUovcx/view>

The first installation can take up to 10 minutes because of this! Depending on your hardware.

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
server: null
```

## 📂 Folder Usage

- `/data`: Used internally by the app for persistent meta-data storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
