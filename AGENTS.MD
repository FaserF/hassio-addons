# AI Agent Reference for hassio-addons

---

## Token Efficiency Rules (CRITICAL — Read First)

These rules apply to **every response** without exception:

1. **Output minimal prose.** Bullet points only. No introductory sentences, no filler, no "Great question!", no "As requested".
2. **No walkthrough unless explicitly asked.** Never create or update `walkthrough.md` unless the user writes "walkthrough" or "summary" in their request.
3. **No implementation plan unless complex.** Skip planning artifacts for simple tweaks, single-file edits, bug fixes, or minor features. Plan only for major architectural changes.
4. **Short change summaries only.** After making changes, output ≤5 bullet points describing *what* changed and *why* — never a line-by-line description.
5. **No repeating file content.** Never echo back code you just wrote or edited. Reference filenames with links instead.
6. **No tool-call narration.** Do not describe what tool you are about to call. Just call it.
7. **Targeted file reads only.** Use `grep_search` or `view_file` with `StartLine`/`EndLine` to read only the relevant section. Never view an entire large file unless strictly necessary.
8. **Use the manifest first.** Before exploring the codebase, read `project_manifest.json` and `project_connections.json`. Do not walk directories recursively.
9. **Parallel tool calls.** Fire all independent tool calls in a single block. Never sequence calls that can run simultaneously.
10. **No re-summarizing artifacts.** After creating or updating an artifact, do NOT restate its contents — just link to it and note any open questions.
11. **Skip trivial confirmations.** Do not ask "Would you like me to proceed?" for obvious next steps. Just do them.
12. **No closing pleasantries.** End your response after the change summary. No "Let me know if you have questions!" etc.
13. **Omit unchanged layers.** If a change only affects one addon, do not mention unrelated addons.
14. **Reuse subagents.** Send follow-up tasks to an existing idle subagent instead of spawning a new one.
15. **Suppress test output noise.** When running linters or tests, only report failures. Do not paste successful output unless the user asks.
16. **Delegate with subagents.** For any research-heavy, multi-file, or parallelizable task, spin up a subagent instead of doing it inline. This keeps your own context lean and reduces token usage for the main conversation.
17. **Reuse idle subagents.** Send follow-up instructions to an already-running subagent via `send_message` — never spawn a new one for the same task thread.
18. **Don't poll subagents.** After launching a subagent, stop calling tools. The system wakes you automatically when the subagent replies.
19. **Subagent scope = minimal.** Give each subagent one focused goal. Never dump the entire task into a single subagent prompt.
20. **Prefer `research` subagent for read-only work.** Codebase exploration, grep searches, file reads, and web lookups should go to the `research` subagent so the main agent stays focused on writing code.
21. **Prefer `self` subagent for isolated execution.** Use the `self` subagent for tasks that need write access in a separate context (e.g. branch workspace edits, test runs, parallel fixes on different addons).

---

## Subagent Strategy

Use subagents proactively whenever a task has independent subtasks, requires heavy research, or would bloat the main context:

| Scenario | Action |
|---|---|
| Reading/searching codebase before coding | Delegate to `research` subagent |
| Parallel changes across multiple addons | Spawn one `self` subagent per addon with `branch` workspace |
| Exploring docs / web while coding continues | Delegate to `research` subagent, continue main task |
| Running lint/tests after a fix | Delegate to `self` subagent, await result |
| Analyzing CI failures + applying a fix | Research subagent reads logs; main agent applies fix |

**Workspace modes:**

- `inherit` — shares parent workspace (default, for read or simple edits)
- `branch` — isolated copy (for concurrent writes to same files)
- `share` — shared repo, independent branch (for parallel addon work)

**Never** do sequential research → code → test all inline in the main agent when any step can be offloaded.

---

## Project Manifest & Connection Map (Single Source of Truth)

Read these before exploring the codebase — they cover all addons, file trees, and per-addon connections:

- **Manifest**: `project_manifest.json` — all addons with versions/arch/images, full file tree, commands.
- **Connections**: `project_connections.json` — per-addon file map (core, rootfs, translations, web assets).

Regenerate after structural changes:

```bash
python .scripts/generate_manifest.py
```

---

## Repository Architecture

This is a **Home Assistant Add-on repository**. Each top-level directory (with a `config.yaml`) is a standalone addon.

### Addon Directory Layout

```
<addon-slug>/
├── config.yaml          # HA addon schema: name, version, arch, options, schema, image
├── Dockerfile           # Multi-arch container build (FROM ghcr.io/hassio-addons/base)
├── run.sh               # Main container entrypoint (Bashio, s6-overlay)
├── build.yaml           # Build metadata (base image pins)
├── CHANGELOG.md         # Version history
├── README.md            # User-facing documentation
├── DOCS.md              # Extended documentation (rendered in HA)
├── rootfs/              # Files copied into the container filesystem
│   ├── etc/             # Config templates, s6 service definitions
│   └── usr/             # Binaries and scripts
├── translations/        # HA UI translation strings (en.yaml, de.yaml, …)
├── www/                 # Static web assets served via HA ingress
└── admin/               # Admin panel (if applicable)
```

### Key Addons

| Slug | Description |
|---|---|
| `ShieldDNS` | High-performance DoT/DoH proxy for AdGuard Home |
| `AegisBot` | Telegram bot integration for Home Assistant |
| `ShieldFile` | Secure file management addon |
| `apache2` | Apache2 web server |
| `nginx` | Nginx web server |
| `planka` | Kanban project management |
| `komodo` | Server management panel |

(Full list in `project_manifest.json` → `addons`)

### Shared Infrastructure

| Path | Purpose |
|---|---|
| `.github/workflows/` | All CI/CD orchestration (orchestrator-*.yaml) |
| `.github/scripts/` | Shared bash scripts used by workflows |
| `.scripts/` | Developer utility scripts (manifest generator, etc.) |
| `tests/` | Pytest test suite for shared logic |
| `docs/` | Repository-level documentation |
| `repository.json` | HA repository metadata |

---

## CLI Commands

| Task | Command |
|---|---|
| Lint Dockerfile | `hadolint <addon>/Dockerfile` |
| Lint shell script | `shellcheck <addon>/run.sh` |
| Lint YAML | `yamllint <addon>/config.yaml` |
| Lint Markdown | `markdownlint '**/*.md'` |
| Run tests | `pytest tests/` |
| Regenerate manifest | `python .scripts/generate_manifest.py` |

---

## Coding Rules

### Home Assistant Addon Standards

- **Bashio**: Use `bashio::config <key>` to read options. Use `bashio::log.info`, `bashio::log.warning`, etc. for logging. Never use raw `echo` for user-visible messages.
- **s6-overlay**: Service scripts in `rootfs/etc/s6-overlay/s6-rc.d/<service>/` must follow the s6 lifecycle (type, run, finish).
- **Base images**: Use pinned `ghcr.io/hassio-addons/base` or `ghcr.io/hassio-addons/base-python` versions. Never use generic `alpine` or `debian` directly.
- **Multi-arch**: All addons must support at minimum `aarch64` and `amd64`. Set `arch` in `config.yaml` accordingly.
- **config.yaml schema**: Every option exposed to users must have a matching `schema` entry with correct type. Use `str?`, `bool?`, `int?` for optional fields.

### Dockerfile Standards

- One `RUN` per logical install block to minimize layers.
- Clean apt/apk caches in the same `RUN` step that installs packages.
- Never `COPY` secrets or `.env` files into the image.
- Must pass `hadolint` (DL warnings are acceptable with justification comments).

### Shell Script Standards

- `#!/usr/bin/with-contenv bashio` as the shebang for HA addon entrypoints.
- `set -e` or equivalent error handling at the top.
- All variables quoted (`"${VAR}"`).
- Must pass `shellcheck --severity=warning`.

### Version Management

- Version is in `config.yaml` as `version: X.Y.Z`.
- Bump version in `config.yaml` and add a `CHANGELOG.md` entry on every release.
- The CI workflow (`orchestrator-release.yaml`) handles automated version bumps.

---

## Bug Fixing & GitHub Issues

1. **Verify first** — check current code before assuming the bug still exists.
2. **Fix only valid issues** — skip stale findings with a one-line reason.
3. **Minimal diff** — touch the fewest files possible.
4. **Validate** — run `hadolint` and `shellcheck` after fixing.

---

## Communication Rules (Summary)

| Rule | Behavior |
|---|---|
| Response length | Bullet points, ≤5 items per change |
| Walkthrough artifact | Only if user explicitly requests it |
| Implementation plan | Only for major architectural changes |
| Asking for confirmation | Never for obvious steps |
| Test output | Failures only |
| Repeating written code | Never |
| Closing remarks | None |
| Language defaults | Code, docs, comments, and AI responses default to English (EN) unless requested otherwise |

---

## Script Rules

- **Temporary scripts & files** (one-off, session-only use): place in `/scratch/` at repo root. Never commit these.
- **Reusable scripts** (utilities, manifest generators): place in `/.scripts/` — never in the repo root directory.
- **No credentials in reusable scripts**: all reusable scripts must read credentials from environment variables or config files — never hardcoded.
- **No secrets anywhere**: every new file must not contain passwords, API keys, or tokens in plaintext.

---

## Language Rules

- **Codebase & Documentation**: All program code, configuration files, documentation, READMEs, and inline comments must always be written in English (EN), unless explicitly requested otherwise.
- **AI Chat Interactions**: The AI must respond in English (EN) by default, unless the user explicitly requests another language.
