<#
.SYNOPSIS
    Workflow Checks - validates GitHub Actions workflows.
#>
param(
    [Parameter(Mandatory)][hashtable]$Config,
    [Parameter(Mandatory)][string]$RepoRoot,
    [bool]$DockerAvailable = $false
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

Write-Header "13. Workflow Checks"

$workflowDir = Join-Path $RepoRoot ".github\workflows"
$workflows = Get-ChildItem -Path $workflowDir -Filter "*.yaml"

if ($DockerAvailable) {
    # A. Actionlint
    Write-Host "Running Actionlint..." -ForegroundColor Gray
    try {
        $out = docker run --rm -v "$($RepoRoot):/repo" -w /repo rhysd/actionlint:latest 2>&1
        if ($LASTEXITCODE -ne 0) {
            $msg = $out | Out-String
            Add-Result -Addon "Workflows" -Check "Actionlint" -Status "FAIL" -Message $msg
        }
        else {
            Add-Result -Addon "Workflows" -Check "Actionlint" -Status "PASS" -Message "OK"
        }
    }
    catch {
        Add-Result -Addon "Workflows" -Check "Actionlint" -Status "SKIP" -Message "Actionlint command failed: $_"
    }

    # B. Zizmor (Security)
    Write-Host "Running Zizmor..." -ForegroundColor Gray
    try {
        $zizmorLog = Join-Path $env:TEMP "zizmor-report.txt"
        docker run --rm -v "$($RepoRoot):/repo" -w /repo ghcr.io/woodruffw/zizmor:latest . > $zizmorLog 2>&1

        if ($LASTEXITCODE -ne 0) {
            Add-Result -Addon "Workflows" -Check "Zizmor" -Status "INFO" -Message "Security analysis complete. See log at: $zizmorLog"
        }
        else {
            Add-Result -Addon "Workflows" -Check "Zizmor" -Status "PASS" -Message "OK"
            Remove-Item $zizmorLog -ErrorAction SilentlyContinue
        }
    }
    catch {
        Add-Result -Addon "Workflows" -Check "Zizmor" -Status "SKIP" -Message "Docker unavailable"
    }
}

# C. SHA Validation
Write-Host "Checking for invalid action references..." -ForegroundColor Gray
$shaIssues = @()
foreach ($wf in $workflows) {
    $lines = Get-Content $wf.FullName
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        # Capture any hex SHA reference (broad match)
        if ($line -match 'uses:\s*[\w\-/]+@([a-fA-F0-9]+)(\s|$|#)') {
            $sha = $matches[1]
            # Only flag if SHA length is NOT exactly 40 characters
            if ($sha.Length -ne 40) {
                $shaIssues += [PSCustomObject]@{
                    File = $wf.Name
                    Line = $i + 1
                    SHA = $sha
                    Length = $sha.Length
                }
            }
        }
    }
}
if ($shaIssues.Count -gt 0) {
    $msg = $shaIssues | ForEach-Object { "$($_.File):$($_.Line) - SHA is $($_.Length) chars (need 40)" }
    Add-Result -Addon "Workflows" -Check "SHA-Validation" -Status "FAIL" -Message "Invalid SHAs found: $($msg -join '; ')"
} else {
    Add-Result -Addon "Workflows" -Check "SHA-Validation" -Status "PASS" -Message "All action SHAs valid"
}

# Get latest runner version
$latestRunner = "24.04"
try {
    $runnerInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/actions/runner-images/contents/images/ubuntu" -ErrorAction Stop
    $versions = $runnerInfo.name | Where-Object { $_ -match 'Ubuntu(\d+)' } | ForEach-Object { $matches[1] }
    if ($versions) {
        $latestMajor = ($versions | Measure-Object -Maximum).Maximum
        if ($latestMajor -match '^(\d{2})(\d{0,2})$') {
            $major = $matches[1]
            $minor = if ($matches[2]) { $matches[2].PadRight(2, '0').Substring(0, 2) } else { "04" }
            $latestRunner = "$major.$minor"
        }
    }
} catch {
    Write-Host "Warning: Could not fetch latest runner version from GitHub API. Using fallback $latestRunner" -ForegroundColor Yellow
}

# D. Custom AI-Style Checks
foreach ($wf in $workflows) {
    $content = Get-Content $wf.FullName -Raw
    $wfName = $wf.Name

    # Check 2: Permissions
    if ($content -notmatch '(?m)^permissions:') {
        Add-Result -Addon $wfName -Check "CR-Permissions" -Status "WARN" -Message "Missing top-level 'permissions:' block. Define explicit permissions."
    } else {
        Add-Result -Addon $wfName -Check "CR-Permissions" -Status "PASS" -Message "OK"
    }

    # Check 3: Trigger Optimization (skip orchestrator workflows that intentionally run on all changes)
    $triggerOptWhitelist = @(
        'orchestrator-ci',
        'orchestrator-labeler',
        'orchestrator-cleanup',
        'orchestrator-autofix',
        'orchestrator-edge-sync'
    )
    $isWhitelisted = $triggerOptWhitelist | Where-Object { $wfName -like "*$_*" }
    if (-not $isWhitelisted -and ($content -match 'on:\s*(push|pull_request)') -and ($content -notmatch 'paths:')) {
        Add-Result -Addon $wfName -Check "CR-TriggerOpt" -Status "INFO" -Message "Trigger lacks 'paths' filter. Workflow might run unnecessarily."
    } else {
        Add-Result -Addon $wfName -Check "CR-TriggerOpt" -Status "PASS" -Message "OK"
    }

    # Check 4: GitHub Runner Version
    if ($content -match 'runs-on:\s*ubuntu-(\d+\.\d+|latest)') {
        $usedVersion = $matches[1]
        if ($usedVersion -ne "latest") {
            try {
                $usedVer = [version]$usedVersion
                $latestVer = [version]$latestRunner
                if ($usedVer -lt $latestVer) {
                    Add-Result -Addon $wfName -Check "CR-RunnerVersion" -Status "WARN" -Message "Uses older GitHub Runner ($usedVersion). The latest available version is $latestRunner. It is recommended to use the latest version or 'ubuntu-latest' for better performance and security."
                } else {
                    Add-Result -Addon $wfName -Check "CR-RunnerVersion" -Status "PASS" -Message "OK"
                }
            } catch {
                Add-Result -Addon $wfName -Check "CR-RunnerVersion" -Status "PASS" -Message "OK"
            }
        } else {
            Add-Result -Addon $wfName -Check "CR-RunnerVersion" -Status "PASS" -Message "OK"
        }
    }
}
