# Changelog

## 1.0.4

- Refactored startup to use S6 legacy services (services.d) properly, fixing PID 1 error.

## 1.0.3

- Fixed s6-overlay-suexec "can only run as pid 1" error by adding `init: false`

## 1.0.1 & 1.0.2

- **Fix**: Critical startup fix. Refactored Container structure (CMD vs S6 services.d) to resolve s6 loop error.

## 1.0.0

- Initial release
