# Bash Script Executer Documentation

Execute your own bash scripts inside this Homeassistant Addon environment.

## ⚙️ Configuration

Configure the app via the **Configuration** tab in the Home Assistant App page.

### Options

```yaml
script_path: /share/scripts/mycoolscript.sh
script_path2: 'false'
script_path3: 'false'
```

## 📂 Folder Usage

- `/share`: Used to store your bash scripts. This is the primary directory where the app looks for scripts to execute.
- `/data`: Used internally by the app for persistent storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
