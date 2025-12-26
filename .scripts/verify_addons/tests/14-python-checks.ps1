<#
.SYNOPSIS
    Python Checks - validates Python formatting using Black and Isort.
#>
param(
    [Parameter(Mandatory)][hashtable]$Config,
    [Parameter(Mandatory)][string]$RepoRoot,
    [bool]$DockerAvailable = $false,
    [switch]$Fix
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

Write-Header "14. Python Checks"

# Paths to check (Scripts + Addons)
$pathsToCheck = @()
if (Test-Path (Join-Path $RepoRoot ".scripts")) {
    $pathsToCheck += Join-Path $RepoRoot ".scripts"
}

# Scan for add-ons with python files
$addons = Get-ChildItem -Path $RepoRoot -Directory | Where-Object {
    (Test-Path "$($_.FullName)\config.yaml") -and ($_.Name -ne ".git") -and ($_.Name -ne ".unsupported")
}
foreach ($addon in $addons) {
    if (Get-ChildItem -Path $addon.FullName -Filter "*.py" -Recurse) {
        $pathsToCheck += $addon.FullName
    }
}

$filesStr = $pathsToCheck -join " "

if (-not $filesStr) {
    Add-Result -Addon "System" -Check "PythonChecks" -Status "SKIP" -Message "No Python files found."
    return
}

# Check Black
$blackMode = if ($Fix) { "Fix" } else { "Check" }
Write-Host "Running Black ($blackMode mode)..." -ForegroundColor Gray
try {
    # Check if black is available via python module
    # Construct argument list properly
    $argsList = @("-m", "black")
    if (-not $Fix) { $argsList += "--check" }
    $argsList += "--verbose"
    $argsList += $pathsToCheck

    $proc = Start-Process -FilePath "python" -ArgumentList $argsList -NoNewWindow -PassThru -Wait

    if ($proc.ExitCode -eq 0) {
        Add-Result -Addon "All" -Check "Black" -Status "PASS" -Message "All files formatted."
    }
    else {
        Add-Result -Addon "All" -Check "Black" -Status "FAIL" -Message "Formatting issues found. Run with -Fix to auto-format."
    }
}
catch {
    Add-Result -Addon "System" -Check "Black" -Status "SKIP" -Message "Black not installed or failed to run: $_"
}

# Check Isort
$isortMode = if ($Fix) { "Fix" } else { "Check" }
Write-Host "Running Isort ($isortMode mode)..." -ForegroundColor Gray
try {
    # Check if isort is available via python module
    # Construct argument list properly
    $argsList = @("-m", "isort")
    if (-not $Fix) { $argsList += "--check-only" }
    $argsList += @("--profile", "black")
    $argsList += $pathsToCheck

    $proc = Start-Process -FilePath "python" -ArgumentList $argsList -NoNewWindow -PassThru -Wait

    if ($proc.ExitCode -eq 0) {
        Add-Result -Addon "All" -Check "Isort" -Status "PASS" -Message "Imports sorted."
    }
    else {
        Add-Result -Addon "All" -Check "Isort" -Status "FAIL" -Message "Import sorting issues found. Run with -Fix to auto-format."
    }
}
catch {
    Add-Result -Addon "System" -Check "Isort" -Status "SKIP" -Message "Isort not installed or failed to run: $_"
}
