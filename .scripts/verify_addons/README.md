# Verify Addons - Home Assistant Add-on Verification Suite

A modular verification suite for Home Assistant add-ons that performs comprehensive checks including linting, security scanning, build validation, and functional testing.

## Directory Structure

```
verify_addons/
├── README.md               # This file
├── lib/
│   └── common.ps1          # Shared functions (Add-Result, Write-Header, etc.)
├── tests/
│   ├── 00-autofix.ps1      # Auto-fix mode
│   ├── 01-line-endings.ps1 # CRLF detection/fix
│   ├── 02-shellcheck.ps1   # Shell script linting
│   ├── 03-hadolint.ps1     # Dockerfile linting
│   ├── 04-yamllint.ps1     # YAML linting
│   ├── 05-markdownlint.ps1 # Markdown linting
│   ├── 06-prettier.ps1     # Code formatting
│   ├── 07-addon-linter.ps1 # HA addon linting
│   ├── 08-compliance.ps1   # Python compliance
│   ├── 09-trivy.ps1        # Security scanning
│   ├── 10-version-check.ps1# Base image versions
│   ├── 11-docker-build-run.ps1 # Build & run tests
│   ├── 12-coderabbit.ps1   # Static analysis
│   └── 13-workflow-checks.ps1 # GitHub Actions
└── config/
    └── test-config.yaml    # Renovate-managed versions
```

## Usage

Run the main orchestrator from the repository root:

```powershell
# Run all tests on all add-ons
.\.scripts\verify_addons.ps1

# Test specific add-on(s)
.\.scripts\verify_addons.ps1 -Addon apache2,openssl

# Run specific tests only
.\.scripts\verify_addons.ps1 -Tests ShellCheck,Hadolint

# Fix issues automatically
.\.scripts\verify_addons.ps1 -Fix

# Only check changed add-ons
.\.scripts\verify_addons.ps1 -ChangedOnly

# Include unsupported add-ons
.\.scripts\verify_addons.ps1 -IncludeUnsupported
```

## Available Tests

| Test | Description | Requires Docker |
|------|-------------|-----------------|
| `LineEndings` | Detects CRLF line endings | No |
| `ShellCheck` | Lints shell scripts | No |
| `Hadolint` | Lints Dockerfiles | Yes |
| `YamlLint` | Lints YAML files | No |
| `MarkdownLint` | Lints Markdown files | No |
| `Prettier` | Checks code formatting | No |
| `AddonLinter` | Official HA addon linter | Yes |
| `Compliance` | Python compliance checks | No |
| `Trivy` | Security vulnerability scanning | Yes |
| `VersionCheck` | Base image version validation | No |
| `DockerBuild` | Builds addon Docker images | Yes |
| `DockerRun` | Runs addons in mock environment | Yes |
| `CodeRabbit` | Static analysis (Dockerfile) | No |
| `WorkflowChecks` | GitHub Actions validation | Yes |

## Running Individual Tests

You can run test modules directly for debugging:

```powershell
# Load common functions first
. .\.scripts\verify_addons\lib\common.ps1
$Config = Get-TestConfig ".\.scripts\verify_addons\config\test-config.yaml"

# Get addons
$addons = Get-ChildItem -Path . -Directory | Where-Object { Test-Path "$($_.FullName)\config.yaml" }

# Run a specific test
& .\.scripts\verify_addons\tests\02-shellcheck.ps1 -Addons $addons -Config $Config
```

## Configuration

The `config/test-config.yaml` file contains:

- **Renovate-managed versions**: Base images, Node.js, builder versions
- **Valid test names**: List of accepted test parameters
- **Docker-dependent tests**: Tests requiring Docker
- **Docs-only tests**: Tests that run on documentation changes

Renovate automatically updates version pins in this file.

## Adding New Tests

1. Create a new file in `tests/` with the naming pattern `XX-testname.ps1`
2. Follow this template:

```powershell
<#
.SYNOPSIS
    Description of your test.
#>
param(
    [Parameter(Mandatory)][array]$Addons,
    [Parameter(Mandatory)][hashtable]$Config,
    [bool]$ChangedOnly = $false,
    [hashtable]$ChangedAddons = @{}
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

Write-Header "XX. Your Test Name"

foreach ($a in $Addons) {
    if (-not (Should-RunTest -AddonName $a.Name -TestName "YourTest" ...)) { continue }

    # Your test logic here

    Add-Result -Addon $a.Name -Check "YourTest" -Status "PASS" -Message "OK"
}
```

3. Add your test to the main orchestrator's test dispatch section
4. Update `config/test-config.yaml` with the new test name

## Shared Functions

The `lib/common.ps1` module provides:

- `Add-Result` - Record test results with colored output
- `Write-Header` - Print section headers
- `Check-Docker` - Verify Docker availability
- `Get-BuildFrom` - Extract base image from build.yaml
- `Get-DefaultOptions` - Extract options from config.yaml
- `Get-RequiredSchemaKeys` - Get required schema keys
- `Should-RunTest` - Test filtering logic
- `Get-TestConfig` - Load YAML configuration

## Output

Results are saved to:
- `verify_log_YYYYMMDD_HHMMSS.txt` - Full transcript
- `verification_results_YYYYMMDD_HHMMSS.json` - JSON results
