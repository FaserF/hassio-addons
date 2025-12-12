# FluxID

FluxID - Identity Management System

This addon provides a self-hosted instance of [FluxID](https://github.com/FaserF/FluxID).

## Configuration

This addon requires a GitHub Personal Access Token to clone the private FluxID repository at runtime.

**Options:**

- `github_url`: The URL of the FluxID repository (Default: `https://github.com/FaserF/FluxID`).
- `github_token`: **[REQUIRED]** Your GitHub Personal Access Token (Classic) with repo read permissions.
- `github_branch`: The branch to clone (Default: `main`).
- `log_level`: Level of logging output (Default: `info`).

## Installation

1. Add this repository to your Home Assistant Add-on Store.
2. Install the "FluxID" add-on.
3. Configure the `github_token` in the Configuration tab.
4. Start the add-on.

**Note:** The first start will take significantly longer as it clones the repository and builds the frontend.
