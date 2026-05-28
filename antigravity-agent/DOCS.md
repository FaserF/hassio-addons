# Home Assistant App: Antigravity Agent

Autonomous AI Coding Agent for Home Assistant using Google Antigravity & Gemini.

## About

Antigravity Agent wraps Google `antigravity-cli` and `gemini-cli` tools to bring autonomous coding capabilities to Home Assistant. By using this App, you can request bug fixes or features through Home Assistant (e.g., Telegram or WhatsApp integrations), which will trigger the AI coding agent to checkout your repository, perform changes, push the changes, and submit a Pull Request.

## Installation

1. Add this repository to your Home Assistant App store.
2. Install the "Antigravity Agent" app.
3. Configure the app settings (tokens and default prompts).
4. Start the app.

## Configuration

**log_level**: Log verbosity (`info`, `debug`, etc.).

**antigravity_token**: API token for the Google Antigravity backend service.

**gemini_token**: API token for Google Gemini AI. (Required for `gemini-cli` prompt builder, maps to `GEMINI_API_KEY`).

**github_token**: A GitHub Personal Access Token (PAT) with repository read/write access.

**default_instruction**: Custom prompt suffix instruction that guides the Antigravity agent's default action.

## REST API Endpoints

The addon runs a REST API server on port `8077` (and is available via Home Assistant Ingress).

### `GET /health`
Returns health check status.

### `POST /api/task`
Trigger an autonomous coding task.

**Payload:**
```json
{
  "repository": "https://github.com/owner/repo",
  "instruction": "Fix typos in README.md",
  "branch": "patch-1",
  "github_token": "optional-override-token",
  "custom_instruction": "optional-custom-instruction"
}
```

**Response:**
```json
{
  "task_id": "8f8b8a5d-...",
  "status": "pending",
  "message": "Workflow initialized in background.",
  "repository": "https://github.com/owner/repo",
  "branch": "patch-1"
}
```

### `GET /api/tasks`
List all historical tasks and status.

### `GET /api/tasks/{task_id}`
Get details of a specific task.

### `GET /api/tasks/{task_id}/logs`
Retrieve log history for a specific task.
