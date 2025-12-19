## 1.1.1

- **Fix**: Resolved `s6-overlay-suexec: fatal: can only run as pid 1` error by adding `init: false` to config.yaml.
- **Fix**: Converted all shell scripts to Unix (LF) line endings to fix bashio shebang errors.

## 1.1.0

- **Refactor**: Complete migration to S6 Overlay structure (cont-init.d & services.d).
- **Improvement**: Better process supervision for FileBrowser.
- **Cleanup**: Removed legacy `run.sh` monolithic script.

## 1.0.1 & 1.0.2

- **Fix**: Critical startup fix. Refactored Container structure (CMD vs S6 services.d) to resolve s6 loop error.

## 1.0.0

- Initial release
