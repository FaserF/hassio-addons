# Bash Script Executer Documentation

Execute your own bash scripts inside this Homeassistant App environment.

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
script_path: /share/scripts/mycoolscript.sh
script_content: |
  echo "Hello World"
```

## 🔘 Native Start Button

The addon automatically installs a Home Assistant integration that provides a button to start the addon. After the first run, a **Home Assistant restart** is required.

## 📂 Folder Usage

- `/share`: Used to store your bash scripts. This is the primary directory where the app looks for scripts to execute.
- `/data`: Used internally by the app for persistent storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
