# Bash Script Executer Documentation

Execute your own bash scripts inside this Homeassistant Addon environment.

## ⚙️ Configuration

Configure the add-on via the **Configuration** tab in the Home Assistant add-on page.

### Options

```yaml
script_path: /share/scripts/mycoolscript.sh
script_path2: 'false'
script_path3: 'false'
```

## 📂 Folder Usage

- `/share`: Used to store your bash scripts. This is the primary directory where the add-on looks for scripts to execute.
- `/data`: Used internally by the add-on for persistent storage.

## Support

For issues and feature requests, please use the GitHub repository issues.
