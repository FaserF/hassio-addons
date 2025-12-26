<#
.SYNOPSIS
    Auto-fix mode - runs fixers on targeted addons.
.DESCRIPTION
    Runs various auto-fix scripts and formatters:
    - Line endings fix
    - Config fixes
    - OCI label fixes
    - Prettier formatting
    - MarkdownLint fixes
#>
param(
    [Parameter(Mandatory)][array]$Addons,
    [Parameter(Mandatory)][hashtable]$Config,
    [bool]$GlobalFix = $false,
    [string]$RepoRoot = "."
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

Write-Header "0. Auto-Fix Mode"

$FixPaths = $Addons | ForEach-Object { $_.FullName }
Write-Host "Running Fixers on $($Addons.Count) targeted paths..." -ForegroundColor Gray

# 1. Repo Maintenance Scripts
Write-Progress -Activity "Auto-Fixing" -Status "Running Repo Maintenance Scripts..." -PercentComplete 10
if (Test-Path ".scripts/fix_line_endings.py") {
    python .scripts/fix_line_endings.py $FixPaths
}
Write-Progress -Activity "Auto-Fixing" -Status "Fixing Configs..." -PercentComplete 20
if (Test-Path ".scripts/fix_configs.py") { python .scripts/fix_configs.py $FixPaths }

if (Test-Path ".scripts/fix_oci_labels.py") {
    python .scripts/fix_oci_labels.py $FixPaths
}

# These scripts are inherently global
if ($GlobalFix) {
    if (Test-Path ".scripts/update_unsupported_status.py") { python .scripts/update_unsupported_status.py }
    if (Test-Path ".scripts/update_readme_status.py") { python .scripts/update_readme_status.py }
    if (Test-Path ".scripts/enforce_architectures.py") { python .scripts/enforce_architectures.py }
}

# standardize_readmes supports --addon argument
Write-Progress -Activity "Auto-Fixing" -Status "Standardizing READMEs..." -PercentComplete 30
if (Test-Path ".scripts/standardize_readmes.py") {
    foreach ($p in $FixPaths) {
        python .scripts/standardize_readmes.py --addon $p
    }
}

# 2. Python Formatting (Black/Isort)
Write-Progress -Activity "Auto-Fixing" -Status "Formatting Python (Black)..." -PercentComplete 45
try {
    $blackArgs = @("-m", "black") + $FixPaths
    python @blackArgs 2>&1 | Out-Null
} catch { Write-Host "Skipping Black (not verified)" -ForegroundColor DarkGray }

Write-Progress -Activity "Auto-Fixing" -Status "Formatting Python (Isort)..." -PercentComplete 60
try {
    $isortArgs = @("-m", "isort") + $FixPaths + "--profile", "black"
    python @isortArgs 2>&1 | Out-Null
} catch { Write-Host "Skipping Isort (not verified)" -ForegroundColor DarkGray }

# 3. Shell Formatting (shfmt)
Write-Progress -Activity "Auto-Fixing" -Status "Formatting Shell Scripts..." -PercentComplete 75
if (Get-Command "shfmt" -ErrorAction SilentlyContinue) {
    try {
        $shfmtArgs = @("-l", "-w") + $FixPaths
        shfmt @shfmtArgs 2>&1 | Out-Null
    } catch {}
}

# 4. Prettier & Markdown
Write-Progress -Activity "Auto-Fixing" -Status "Running Prettier..." -PercentComplete 85
try {
    $prettierTargets = $FixPaths
    $ignorePath = Join-Path $RepoRoot ".prettierignore"
    npx prettier --write $prettierTargets --ignore-path "$ignorePath"
} catch {}

Write-Progress -Activity "Auto-Fixing" -Status "Running MarkdownLint..." -PercentComplete 95
try {
    $mdTargets = $FixPaths
    $configPath = Join-Path $RepoRoot ".markdownlint.yaml"
    npx markdownlint-cli $mdTargets --config "$configPath" --fix --ignore "node_modules" --ignore ".git"
} catch {}

Write-Progress -Activity "Auto-Fixing" -Completed
Write-Host "Auto-fix complete." -ForegroundColor Green
