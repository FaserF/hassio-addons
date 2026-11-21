# AI Agent Operational Reference & Guidelines

Mandatory operational guidelines and standards for AI coding agents (Antigravity, Hermes Agent, OpenHands, Claude Code, Paseo) working across `@FaserF` repositories.

---

## 1. Identity & Commits
* **Bot Identity:** Automated actions, reviews, commits, and pull requests must be executed as `faserf-hermes-agent[bot]`.
* **Author Details:**
  * Git Name: `faserf-hermes-agent[bot]`
  * Git Email: `342667397+faserf-hermes-agent[bot]@users.noreply.github.com`
* **Conventional Commits:** All commits must follow conventional format (`feat(...)`, `fix(...)`, `chore(...)`, `refactor(...)`, `test(...)`, `docs(...)`).
* **Pull Requests:** PR descriptions must link to corresponding issues (`Closes #123`, `Fixes #123`) and include an automated change summary.

---

## 2. Token & Execution Efficiency
* **Minimal Prose:** Explanations and PR comments must be concise, structured with bullet points, and free of filler phrases.
* **Targeted Reads & Diffs:** Read specific line ranges when analyzing code. Never re-print large existing source files in comments or logs.
* **No Hardcoded Secrets:** Never hardcode or commit tokens, private keys, passwords, or credentials. All secrets must reside in GitHub Secrets or Infisical.
* **English Default (EN):** All code, variable names, commit messages, pull requests, issue templates, and AI comments must strictly default to English (EN).

---

## 3. Code Quality & Architectural Hygiene
* **File Limits:** Source files should strictly adhere to $\le 600$ lines (ideal target: $< 300$ lines). Break monolithic modules into cohesive sub-modules.
* **Exception Hygiene:**
  * NEVER use `raise e`. ALWAYS use `raise ... from e` or a naked `raise` to preserve tracebacks.
  * Silent failures (`except: pass`) are strictly forbidden. Always log at `warning` or `debug` level.
* **Type Safety & Linting:** Strict typing (`mypy` / `pyright`), Python `ruff` format and linting, Go `golangci-lint`, JavaScript/TypeScript `eslint`.
* **Testing:** All new features or bug fixes must include corresponding unit tests (`pytest`, `go test`, `npm test`). Never weaken existing test assertions.

---

## 4. Privacy & Attribution Guardrails
* **No Personal Domain Exposure:** Do NOT insert links to `fabiseitz.de` or internal Tailscale endpoints in public repositories or PR reviews.
* **Bot Verification Link:** Reference the official GitHub App for information on automated agent actions:
  [Hermes Agent GitHub App](https://github.com/apps/faserf-hermes-agent)
