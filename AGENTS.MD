# AI Agent Reference: hassio-addons

## 1. Rules & Token Efficiency
- Output: Bullet points only (<=5 items for changes), no pleasantries/filler/narration, default English (EN).
- Code/Files: Targeted reads (`StartLine`/`EndLine`). Markdown links only, no code echo. No unrequested plans/walkthroughs.
- Manifest First: Consult `project_manifest.json` and `project_connections.json` before codebase exploration.
- Linters/Tests: Report failures only. Verify before concluding tasks.

## 2. Addon Architecture & Layout
```text
<addon-slug>/
├── config.yaml          # HA schema: name, version, arch, options, schema, image
├── Dockerfile           # Multi-arch (ghcr.io/hassio-addons/base), single RUN per block
├── run.sh               # #!/usr/bin/with-contenv bashio, set -e, quoted vars
├── build.yaml           # Base image pins
├── rootfs/etc/s6-overlay/s6-rc.d/<service>/ # s6 lifecycle: type, run, finish
└── translations/        # HA UI translations (en.yaml, de.yaml)
```

## 3. Mandatory Standards & Quality
- **Bashio**: Use `bashio::config <key>` and `bashio::log.*`. Never raw `echo` for user messages.
- **Base Images**: Pinned `ghcr.io/hassio-addons/base` or `base-python`. Multi-arch minimum: `aarch64`, `amd64`.
- **Quality**: No `raise e` (use `raise ... from e` or naked `raise`). `except: pass` strictly forbidden. No third-party bot names.
- **Lifecycle & Versioning**:
  - New add-ons start strictly at `0.1.0` in `.dev/<addon-slug>` on `master`.
  - Slug must be listed in `DEV_ADDONS` in `.scripts/addons_config.py` (blacklist for stable releases).
  - Unpacked to root on `edge` branch by `.scripts/prepare_edge_branch.py`.
  - Warning emitted if add-on in `DEV_ADDONS` reaches `>= 1.0.0`.

## 4. Verification CLI Commands
- Dockerfile lint: `hadolint <addon>/Dockerfile`
- Shell script lint: `shellcheck <addon>/run.sh`
- YAML lint: `yamllint <addon>/config.yaml`
- Tests: `pytest tests/`
- Manifest regen: `python .scripts/generate_manifest.py`
