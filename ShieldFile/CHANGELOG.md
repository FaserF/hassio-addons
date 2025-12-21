# Changelog

## 1.0.10

- Added `ENTRYPOINT []` to Dockerfile to guarantee S6 overlay is disabled.

## 1.0.9

- Refactored startup to use direct `CMD` execution instead of S6 services to definitively resolve PID 1 errors.
- **Note**: This requires a manual `git push` to take effect.

## 1.0.8

- Added debug logging to verify execution of new script version.

## 1.0.7

- Re-release to ensure manual environment loading fix is propagated.

## 1.0.6

- Implemented manual environment loading to fix PID 1 error while maintaining Supervisor API access.

## 1.0.5

- Removed `with-contenv` from shebang to permanently resolve the "s6-overlay-suexec: fatal: can only run as pid 1" error.

## 1.0.4

- Refactored startup to use S6 legacy services (services.d) properly, fixing PID 1 error.

## 1.0.3

- Fixed s6-overlay-suexec "can only run as pid 1" error by adding `init: false`

## 1.0.1 & 1.0.2

- **Fix**: Critical startup fix. Refactored Container structure (CMD vs S6 services.d) to resolve s6 loop error.

## 1.0.0

- Initial release
