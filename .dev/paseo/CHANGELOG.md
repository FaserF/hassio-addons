# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-10-16

### Added

- Added `oracle_cloud_preset` option (default `false`) allowing users to instantly preload the full multi-agent configuration from Oracle Cloud (`supervisor`, `coder`, `reviewer`, `explorer`, `searcher`, `tester`, `browser-qa`, `security-auditor`, and OmniRoute cascades).

## [0.1.0] - 2026-10-16

### Added

- Initial release of Paseo Home Assistant Add-on.
- Native Ingress support on port `8099` proxying seamlessly into Paseo on `6767`.
- Auto-opening Home Assistant `/config` workspace for instant access to YAML automations, scripts, and configurations.
- Direct OmniRoute integration with pre-configured cascades (`coding-cascade`, `fast-cascade`, `reasoning-latest`).
- Optional remote access on port `6767` for orchestration via Oracle Cloud VM (`https://code.fabiseitz.de`), Hermes, and Tailscale.
- S6-overlay v3 process supervision with isolated initialization and Ingress proxying.
