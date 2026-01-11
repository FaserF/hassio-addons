# Log Level Configuration - Best Practices

## Overview
This document provides standardized patterns for implementing robust `log_level` configuration in Home Assistant add-ons.

## Standard Pattern

### 1. Basic Error Handling (Recommended)
```bash
# Fetch log_level with explicit error handling and default fallback
if ! LOG_LEVEL=$(bashio::config 'log_level') || [ -z "$LOG_LEVEL" ]; then
    bashio::log.warning "Failed to fetch log_level configuration. Using default: info"
    LOG_LEVEL="info"
fi
```

**Why?**
- Explicit error detection if `bashio::config` fails
- Warning log informs user of the fallback
- Ensures `LOG_LEVEL` is never empty
- Consistent fallback behavior across all add-ons

### 2. Alternative: has_value Check
```bash
# Alternative pattern using has_value (also acceptable)
if ! LOG_LEVEL=$(bashio::config 'log_level') || [ - "$LOG_LEVEL" ]; then
    bashio::log.warning "Failed to fetch log_level configuration. Using default: info"
    LOG_LEVEL="info"
fi
```

## Configuration Schema

### config.yaml
```yaml
options:
  log_level: info  # Default value

schema:
  log_level?: list(trace|debug|info|notice|warning|error|fatal)
```

**Important:**
- Use `?` suffix to mark as optional (`log_level?:`)
- Use `list()` for dropdown selection, NOT `match()`
- Provide sensible default (`info` recommended)

## Common Log Level Mappings

### Nginx
```bash
# Bashio: trace, debug, info, notice, warning, error, fatal
# Nginx: debug, info, notice, warn, error, crit, alert, emerg
nginx_log_level="warn"
case "${LOG_LEVEL}" in
    trace|debug) nginx_log_level="debug" ;;
    info)        nginx_log_level="info" ;;
    notice)      nginx_log_level="notice" ;;
    warning)     nginx_log_level="warn" ;;
    error)       nginx_log_level="error" ;;
    fatal)       nginx_log_level="crit" ;;
    *)           nginx_log_level="warn" ;;
esac
```

### Python (Uvicorn/FastAPI)
```bash
# Bashio: trace, debug, info, notice, warning, error, fatal
# Python: trace, debug, info, warning, error, critical
case "$LOG_LEVEL" in
    trace)   PYTHON_LOG="trace" ;;
    debug)   PYTHON_LOG="debug" ;;
    info)    PYTHON_LOG="info" ;;
    notice)  PYTHON_LOG="info" ;;    # Map notice → info
    warning) PYTHON_LOG="warning" ;;
    error)   PYTHON_LOG="error" ;;
    fatal)   PYTHON_LOG="critical" ;; # Map fatal → critical
    *)       PYTHON_LOG="info" ;;
esac
```

### Node.js (Pino)
```javascript
// Map addon log levels to pino-compatible levels
const RAW_LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_LEVEL_MAP = {
  'trace': 'trace',
  'debug': 'debug',
  'info': 'info',
  'notice': 'info',  // pino doesn't have 'notice'
  'warning': 'warn',
  'error': 'error',
  'fatal': 'fatal'
};
const LOG_LEVEL = LOG_LEVEL_MAP[RAW_LOG_LEVEL.toLowerCase()] || 'info';
```

## Complete Example

```bash
#!/usr/bin/with-contenv bashio

# Fetch log level with error handling
if ! LOG_LEVEL=$(bashio::config 'log_level') || [ -z "$LOG_LEVEL" ]; then
    bashio::log.warning "Failed to fetch log_level configuration. Using default: info"
    LOG_LEVEL="info"
fi

# Apply to bashio logging
bashio::log.level "${LOG_LEVEL}"
bashio::log.info "Log level set to ${LOG_LEVEL}"

# Map to application-specific log level (e.g., Nginx)
nginx_log_level="warn"
case "${LOG_LEVEL}" in
    trace|debug) nginx_log_level="debug" ;;
    info)        nginx_log_level="info" ;;
    notice)      nginx_log_level="notice" ;;
    warning)     nginx_log_level="warn" ;;
    error)       nginx_log_level="error" ;;
    fatal)       nginx_log_level="crit" ;;
    *)           nginx_log_level="warn" ;;
esac

# Apply to Nginx configuration
sed -i "s|error_log .*|error_log /var/log/nginx/error.log ${nginx_log_level};|" /etc/nginx/nginx.conf
```

## Checklist for New Add-ons

- [ ] Add `log_level` to `options` with default value (`info`)
- [ ] Add `log_level?:` to `schema` with validator
- [ ] Use `list()` validator, not `match()`
- [ ] Implement error handling when fetching log_level
- [ ] Log warning message if fallback is used
- [ ] Map to application-specific log levels
- [ ] Add translations (at minimum `en.yaml`, ideally `de.yaml`)
- [ ] Quote translation name values
- [ ] Apply log level to bashio: `bashio::log.level "${LOG_LEVEL}"`
- [ ] Test with invalid / empty configuration
