<#
.SYNOPSIS
    Runs local CI/CD verification for Home Assistant Add-ons V2.2 (Modular).
#>

param(
    [string[]]$Addon = @("all"),
    [string[]]$Tests = @("all"),
    [switch]$IncludeUnsupported,
    [switch]$Fix,
    [switch]$ChangedOnly,
    [switch]$CacheImages,
    [string]$OutputDir,
    [switch]$Help
)

# --- SETUP ---
$ErrorActionPreference = "Continue"
$RepoRoot = Resolve-Path "$PSScriptRoot\..\.."
$env:PYTHONIOENCODING = "utf-8"
$ModuleDir = $PSScriptRoot
$TestsDir = Join-Path $ModuleDir "tests"

# Reset Global State
$global:Results = @()
$global:GlobalFailed = $false

# Load Common Module
. "$ModuleDir/lib/common.ps1"

# Load Configuration
$Config = Get-TestConfig "$ModuleDir/config/test-config.yaml"

# --- UNIFIED HEADER ---
function Show-Header {
    $version = if ($Config.scriptVersion) { "v$($Config.scriptVersion)" } else { "" }
    # Pad to ensure alignment if possible, roughly
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host "   🏠  Home Assistant Add-on Verification Suite (Modular) $version  ✅" -ForegroundColor White
    Write-Host "================================================================================" -ForegroundColor Cyan
    Write-Host ""
}

# --- HELP FUNCTION ---
function Show-Help {
    Show-Header
    Write-Host "NAME" -ForegroundColor Yellow
    Write-Host "    verify_addons.ps1 - Home Assistant Add-on Verification & CI/CD Tool"
    Write-Host ""
    Write-Host "SYNOPSIS" -ForegroundColor Yellow
    Write-Host "    .\verify_addons.ps1 [-Addon <String[]>] [-Tests <String[]>] [-Fix] [-ChangedOnly]"
    Write-Host "                        [-IncludesUnsupported] [-OutputDir <String>] [-Help]"
    Write-Host ""
    Write-Host "DESCRIPTION" -ForegroundColor Yellow
    Write-Host "    The verify_addons utility is a comprehensive testing suite for Home Assistant"
    Write-Host "    Add-ons. It automates linting, security scanning, configuration validation,"
    Write-Host "    Dockerfile analysis, and functional testing using a mock Supervisor environment."
    Write-Host ""
    Write-Host "    It is designed to be used both locally by developers and automatically in CI/CD"
    Write-Host "    pipelines (GitHub Actions)."
    Write-Host ""
    Write-Host "OPTIONS" -ForegroundColor Yellow
    Write-Host "    -Addon <String[]>" -ForegroundColor Green
    Write-Host "        Specifies which add-ons to verify. Accepts a comma-separated list of add-on"
    Write-Host "        slugs (directory names). Use 'all' to verify all detected add-ons."
    Write-Host "        Default: 'all'"
    Write-Host ""
    Write-Host "    -Tests <String[]>" -ForegroundColor Green
    Write-Host "        Specifies which tests to run. Accepts a comma-separated list of test names."
    Write-Host "        Available tests:"
    Write-Host "          LineEndings, ShellCheck, Hadolint, YamlLint, MarkdownLint, Prettier,"
    Write-Host "          AddonLinter, Compliance, Trivy, VersionCheck, DockerBuild, DockerRun,"
    Write-Host "          CodeRabbit, WorkflowChecks, PythonChecks, CustomTests."
    Write-Host "        Use 'all' to run all available tests."
    Write-Host "        Default: 'all'"
    Write-Host ""
    Write-Host "    -Fix" -ForegroundColor Green
    Write-Host "        Enables auto-fixing for compatible tests (e.g., Prettier, LineEndings)."
    Write-Host "        WARNING: This modifies files in place."
    Write-Host ""
    Write-Host "    -CacheImages" -ForegroundColor Green
    Write-Host "        If enabled, skips rebuilding Docker images if a valid 'local/test-<addon>' image"
    Write-Host "        already exists. Useful for repeated test runs. Default: Disabled (Always Rebuild)."
    Write-Host ""
    Write-Host "    -ChangedOnly" -ForegroundColor Green
    Write-Host "        Limits the verification to add-ons that have uncommitted changes or are"
    Write-Host "        modified relative to the git 'origin'. Ideal for pre-commit hooks."
    Write-Host ""
    Write-Host "    -IncludeUnsupported" -ForegroundColor Green
    Write-Host "        Includes add-ons located in the '.unsupported' directory in the verification"
    Write-Host "        process. By default, these are ignored."
    Write-Host ""
    Write-Host "    -OutputDir <String>" -ForegroundColor Green
    Write-Host "        Specifies a custom directory for log files and report artifacts."
    Write-Host "        Default: './logs'"
    Write-Host ""
    Write-Host "    -Help" -ForegroundColor Green
    Write-Host "        Displays this help message and exits."
    Write-Host ""
    Write-Host "EXAMPLES" -ForegroundColor Yellow
    Write-Host "    .\verify_addons.ps1"
    Write-Host "        Run all tests on all add-ons."
    Write-Host ""
    Write-Host "    .\verify_addons.ps1 -Addon 'apache2,mariadb' -Tests 'DockerBuild,DockerRun'"
    Write-Host "        Run only Docker build and run tests for Apache2 and MariaDB."
    Write-Host ""
    Write-Host "    .\verify_addons.ps1 -ChangedOnly -Fix"
    Write-Host "        Run verification on currently modified add-ons and auto-fix formatting issues."
    Write-Host ""
    Write-Host "EXIT STATUS" -ForegroundColor Yellow
    Write-Host "    0    Success. All checks passed."
    Write-Host "    1    Failure. One or more checks failed or invalid arguments were provided."
    Write-Host ""
}

if ($Help) {
    Show-Help
    exit 0
}

# --- SETUP ---
$ErrorActionPreference = "Continue"
$RepoRoot = Resolve-Path "$PSScriptRoot\..\.."
$env:PYTHONIOENCODING = "utf-8"
$ModuleDir = $PSScriptRoot
$TestsDir = Join-Path $ModuleDir "tests"

# Reset Global State
$global:Results = @()
$global:GlobalFailed = $false

# Load Common Module
. "$ModuleDir/lib/common.ps1"

# Load Configuration
$Config = Get-TestConfig "$ModuleDir/config/test-config.yaml"

# --- PARAMETER VALIDATION ---
if ($args) {
    Write-Host "ERROR: Unknown parameters detected: $($args -join ' ')" -ForegroundColor Red
    Write-Host ""
    Show-Help
    exit 1
}

# Handle comma-separated strings
if ($Tests.Count -eq 1 -and $Tests[0] -match ",") {
    $Tests = $Tests[0] -split "," | ForEach-Object { $_.Trim() }
}
if ($Addon.Count -eq 1 -and $Addon[0] -match ",") {
    $Addon = $Addon[0] -split "," | ForEach-Object { $_.Trim() }
}

# Validate Tests
foreach ($t in $Tests) {
    if ($t -notin $Config.validTests) {
        Write-Host "ERROR: Invalid Test detected: '$t'" -ForegroundColor Red
        exit 1
    }
}

# --- LOGGING SETUP ---
if (-not $OutputDir) { $OutputDir = Join-Path $ModuleDir "logs" }
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$LogFile = Join-Path $OutputDir "verify_log_$Timestamp.txt"
$JsonFile = Join-Path $OutputDir "verification_results_$Timestamp.json"

try {
    try { Stop-Transcript | Out-Null } catch {}
    Start-Transcript -Path $LogFile -Force
}
catch {
    Write-Warning "Could not start transcript at $LogFile. logging to console only."
}

# Banner
# Banner
$ScriptStartTime = Get-Date
Write-Host ""
Show-Header
Write-Host "  Started at: $($ScriptStartTime.ToString())" -ForegroundColor Gray

# Check for Updates (wrapped in try/catch to not block main execution)
try {
    Check-ForUpdates -CurrentVersion $Config.scriptVersion -CacheDir $OutputDir
}
catch {
    Write-Host "Warning: Update check failed: $_" -ForegroundColor Yellow
}

try {
    # --- SCOPE DEFINITION ---
    $ChangedAddons = @{}

    if ($ChangedOnly) {
        Write-Host "Detecting changed files via git..." -ForegroundColor Gray
        $gitStatus = git status --porcelain 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Git not available or not a git repository. -ChangedOnly ignored."
            $ChangedOnly = $false
        }
        else {
            foreach ($line in $gitStatus) {
                if ($line.Length -lt 4) { continue }
                $file = $line.Substring(3).Trim()
                $parts = $file.Split([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)

                $addonName = $null
                if ($parts.Count -ge 2 -and $parts[0] -eq ".unsupported") {
                    $addonName = $parts[1]
                }
                elseif ($parts.Count -ge 1) {
                    # Check if it's a known addon directory
                    $potential = $parts[0]
                    $potentialConfigPath = Join-Path $RepoRoot (Join-Path $potential "config.yaml")
                    if (Test-Path $potentialConfigPath) {
                        $addonName = $potential
                    }
                }

                if ($addonName) {
                    $isDoc = $file -match 'README\.md$|CHANGELOG\.md$'
                    $currentType = if ($ChangedAddons.ContainsKey($addonName)) { $ChangedAddons[$addonName] } else { "Docs" }

                    if (-not $isDoc) {
                        $ChangedAddons[$addonName] = "Code"
                    }
                    elseif ($currentType -eq "Docs") {
                        $ChangedAddons[$addonName] = "Docs"
                    }
                }
            }

            if ($ChangedAddons.Count -eq 0) {
                Write-Host "No uncommitted changes detected in add-ons. Nothing to do." -ForegroundColor Green
                exit 0
            }
            Write-Host "Changes detected in: $($ChangedAddons.Keys -join ', ')" -ForegroundColor Gray
        }
    }

    # Get Addons List
    if ($Addon.Count -eq 1 -and $Addon[0] -eq "all") {
        $addons = @(Get-ChildItem -Path $RepoRoot -Directory | Where-Object {
                (Test-Path "$($_.FullName)\config.yaml") -and ($_.Name -ne ".git") -and ($_.Name -ne ".unsupported") -and ($_.Name -ne "homeassistant-test-instance") -and ($_.Name -notmatch "^tmp")
            })
        if ($IncludeUnsupported) {
            $unsupPath = Join-Path $RepoRoot ".unsupported"
            $unsup = Get-ChildItem -Path $unsupPath -Directory -ErrorAction SilentlyContinue
            if ($unsup) { $addons += $unsup }
        }

        if ($ChangedOnly) {
            $addons = $addons | Where-Object { $ChangedAddons.ContainsKey($_.Name) }
        }
    }
    else {
        $addons = @()
        foreach ($addonName in $Addon) {
            $fullPath = Join-Path $RepoRoot $addonName
            $unsupportedPath = Join-Path $RepoRoot ".unsupported\$addonName"

            if (Test-Path $fullPath) {
                $addons += Get-Item $fullPath
            }
            elseif (Test-Path $unsupportedPath) {
                $addons += Get-Item $unsupportedPath
            }
            else {
                Write-Host "WARNING: Add-on '$addonName' not found, skipping." -ForegroundColor Yellow
            }
        }
        if ($addons.Count -eq 0) {
            Write-Host "ERROR: No valid add-ons found from the provided list." -ForegroundColor Red

            Write-Host "`nAvailable add-ons:" -ForegroundColor Yellow
            $allAddons = Get-ChildItem -Path $RepoRoot -Directory | Where-Object { (Test-Path "$($_.FullName)\config.yaml") -and ($_.Name -ne ".git") -and ($_.Name -ne ".unsupported") -and ($_.Name -ne "homeassistant-test-instance") -and ($_.Name -notmatch "^tmp") }
            foreach ($a in $allAddons) {
                Write-Host "  - $($a.Name)" -ForegroundColor Gray
            }
            if (Test-Path (Join-Path $RepoRoot ".unsupported")) {
                $unsup = Get-ChildItem -Path (Join-Path $RepoRoot ".unsupported") -Directory -ErrorAction SilentlyContinue
                if ($unsup) {
                    Write-Host "  - (Unsupported/Archived):" -ForegroundColor DarkGray
                    foreach ($u in $unsup) { Write-Host "    - $($u.Name)" -ForegroundColor DarkGray }
                }
            }
            $global:GlobalFailed = $true
            exit 1
        }

        if ($ChangedOnly) {
            $addons = $addons | Where-Object { $ChangedAddons.ContainsKey($_.Name) }
            if ($addons.Count -eq 0) {
                Write-Host "None of the specified add-ons have uncommitted changes. Skipping." -ForegroundColor Green
                exit 0
            }
        }
    }

    if ($addons.Count -gt 0) {
        if ("all" -notin $Addon -or $ChangedOnly) {
            Write-Host "Targeting $($addons.Count) add-on(s): $($addons.Name -join ', ')" -ForegroundColor Cyan
        }
        else {
            Write-Host "Targeting all $($addons.Count) detected add-ons." -ForegroundColor Gray
        }

        # --- ETA CALCULATION ---
        $totalSeconds = 0.0
        $activeTests = @()
        if ("all" -in $Tests) {
            $activeTests = $Config['validTests'] | Where-Object { $_ -ne "all" }
        }
        else {
            $activeTests = $Tests
        }

        if ($Fix -and $Config['testWeights'] -and $Config['testWeights']['AutoFix']) {
            $totalSeconds += ([double]$addons.Count * [double]$Config['testWeights']['AutoFix'])
        }

        if ($Config['testWeights']) {
            foreach ($t in $activeTests) {
                # Heuristic: Docker tests skip if docker missing, but we show max ETA first.
                $weight = $Config['testWeights'][$t]
                if ($weight) {
                    $totalSeconds += ([double]$addons.Count * [double]$weight)
                }
            }
        }

        if ($totalSeconds -gt 0) {
            $etaSpan = [TimeSpan]::FromSeconds($totalSeconds)
            $etaStr = ""
            if ($etaSpan.Hours -gt 0) { $etaStr += "$($etaSpan.Hours)h " }
            if ($etaSpan.Minutes -gt 0) { $etaStr += "$($etaSpan.Minutes)m " }
            $etaStr += "$($etaSpan.Seconds)s"

            # Write to Console (Colored) - captured by transcript automatically
            Write-Host "  Estimated Duration: ~$($etaStr.Trim()) (varies by hardware and addon complexity)" -ForegroundColor Gray
            Write-Host ""
        }

        # --- DOCKER AVAILABILITY ---
        $DockerAvailable = $false
        if ("all" -in $Tests -or ($Tests | Where-Object { $_ -in $Config['dockerTests'] })) {
            $DockerAvailable = Check-Docker
            if (-not $DockerAvailable) {
                Write-Host "WARNING: Docker is not available. Docker-related tests will be skipped." -ForegroundColor Yellow
            }
        }
    }

    # --- EXECUTE TESTS ---

    # 0. Auto-Fix
    if ($Fix) {
        Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[0 / 15] Running Auto-Fix..." -PercentComplete 0
        $oldPP = $ProgressPreference; $ProgressPreference = 'SilentlyContinue'
        try {
            & "$TestsDir/00-autofix.ps1" -Addons $addons -Config $Config -GlobalFix ("all" -in $Addon -and -not $ChangedOnly) -RepoRoot $RepoRoot
        }
        catch {
            Add-Result -Addon "System" -Check "AutoFix" -Status "SKIP" -Message "Module Crashed: $_"
        }
        finally { $ProgressPreference = $oldPP }
    }

    # 1. Line Endings
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[1 / 15] Line Endings" -PercentComplete 5
    if ("all" -in $Tests -or "LineEndings" -in $Tests) {
        try {
            & "$TestsDir/01-line-endings.ps1" -Addons $addons -Config $Config -Fix $Fix -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -RepoRoot $RepoRoot
        }
        catch {
            Add-Result -Addon "System" -Check "LineEndings" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 2. ShellCheck
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[2 / 15] ShellCheck" -PercentComplete 10
    if ("all" -in $Tests -or "ShellCheck" -in $Tests) {
        try {
            & "$TestsDir/02-shellcheck.ps1" -Addons $addons -Config $Config -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -RepoRoot $RepoRoot
        }
        catch {
            Add-Result -Addon "System" -Check "ShellCheck" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 3. Hadolint
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[3 / 15] Hadolint" -PercentComplete 15
    if ("all" -in $Tests -or "Hadolint" -in $Tests) {
        try {
            & "$TestsDir/03-hadolint.ps1" -Addons $addons -Config $Config -DockerAvailable $DockerAvailable -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -RepoRoot $RepoRoot
        }
        catch {
            Add-Result -Addon "System" -Check "Hadolint" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 4. YamlLint
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[4 / 15] YamlLint" -PercentComplete 25
    if ("all" -in $Tests -or "YamlLint" -in $Tests) {
        try {
            & "$TestsDir/04-yamllint.ps1" -Addons $addons -Config $Config -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -RepoRoot $RepoRoot
        }
        catch {
            Add-Result -Addon "System" -Check "YamlLint" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 5. MarkdownLint
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[5 / 15] MarkdownLint" -PercentComplete 35
    if ("all" -in $Tests -or "MarkdownLint" -in $Tests) {
        try {
            & "$TestsDir/05-markdownlint.ps1" -Addons $addons -Config $Config -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -RepoRoot $RepoRoot
        }
        catch {
            Add-Result -Addon "System" -Check "MarkdownLint" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 6. Prettier
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[6 / 15] Prettier" -PercentComplete 45
    if ("all" -in $Tests -or "Prettier" -in $Tests) {
        try {
            & "$TestsDir/06-prettier.ps1" -Addons $addons -Config $Config -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -RepoRoot $RepoRoot
        }
        catch {
            Add-Result -Addon "System" -Check "Prettier" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 7. Add-on Linter
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[7 / 15] Add-on Linter" -PercentComplete 55
    if ("all" -in $Tests -or "AddonLinter" -in $Tests) {
        try {
            & "$TestsDir/07-addon-linter.ps1" -Addons $addons -Config $Config -DockerAvailable $DockerAvailable -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -RepoRoot $RepoRoot
        }
        catch {
            Add-Result -Addon "System" -Check "AddonLinter" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 8. Compliance
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[8 / 15] Compliance" -PercentComplete 60
    if ("all" -in $Tests -or "Compliance" -in $Tests) {
        try {
            & "$TestsDir/08-compliance.ps1" -Addons $addons -Config $Config -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -RepoRoot $RepoRoot
        }
        catch {
            Add-Result -Addon "System" -Check "Compliance" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 9. Trivy
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[9 / 15] Trivy" -PercentComplete 70
    if ("all" -in $Tests -or "Trivy" -in $Tests) {
        try {
            & "$TestsDir/09-trivy.ps1" -Addons $addons -Config $Config -RepoRoot $RepoRoot -DockerAvailable $DockerAvailable -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons
        }
        catch {
            Add-Result -Addon "System" -Check "Trivy" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 10. Version Check
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[10 / 15] Version Check" -PercentComplete 80
    if ("all" -in $Tests -or "VersionCheck" -in $Tests) {
        try {
            & "$TestsDir/10-version-check.ps1" -Addons $addons -Config $Config -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -RepoRoot $RepoRoot
        }
        catch {
            Add-Result -Addon "System" -Check "VersionCheck" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 11. Docker Build & Run
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[11 / 15] Docker Build & Run" -PercentComplete 85
    if ("all" -in $Tests -or "DockerBuild" -in $Tests -or "DockerRun" -in $Tests) {
        try {
            $runTests = ("all" -in $Tests -or "DockerRun" -in $Tests)
            & "$TestsDir/11-docker-build-run.ps1" -Addons $addons -Config $Config -OutputDir $OutputDir -RepoRoot $RepoRoot -DockerAvailable $DockerAvailable -RunTests $runTests -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -CacheImages:$CacheImages
        }
        catch {
            Add-Result -Addon "System" -Check "DockerBuildRun" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 12. CodeRabbit
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[12 / 15] CodeRabbit" -PercentComplete 90
    if ("all" -in $Tests -or "CodeRabbit" -in $Tests) {
        try {
            & "$TestsDir/12-coderabbit.ps1" -Addons $addons -Config $Config -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -RepoRoot $RepoRoot
        }
        catch {
            Add-Result -Addon "System" -Check "CodeRabbit" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 13. Workflow Checks
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[13 / 15] Workflow Checks" -PercentComplete 95
    if ("all" -in $Tests -or "WorkflowChecks" -in $Tests) {
        try {
            & "$TestsDir/13-workflow-checks.ps1" -Config $Config -RepoRoot $RepoRoot -DockerAvailable $DockerAvailable
        }
        catch {
            Add-Result -Addon "System" -Check "WorkflowChecks" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    # 14. Python Checks
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[14 / 15] Python Checks" -PercentComplete 95
    if ("all" -in $Tests -or "PythonChecks" -in $Tests) {
        $oldPP = $ProgressPreference; $ProgressPreference = 'SilentlyContinue'
        try {
            & "$TestsDir/14-python-checks.ps1" -Config $Config -RepoRoot $RepoRoot -DockerAvailable $DockerAvailable -Fix:$Fix
        }
        catch {
            Add-Result -Addon "System" -Check "PythonChecks" -Status "SKIP" -Message "Module Crashed: $_"
        }
        finally { $ProgressPreference = $oldPP }
    }

    # 15. Custom Addon Tests
    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Status "[15 / 15] Custom Addon Tests" -PercentComplete 98
    if ("all" -in $Tests -or "CustomTests" -in $Tests) {
        try {
            & "$TestsDir/15-custom-addon-tests.ps1" -Addons $addons -Config $Config -OutputDir $OutputDir -RepoRoot $RepoRoot -DockerAvailable $DockerAvailable -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons
        }
        catch {
            Add-Result -Addon "System" -Check "CustomTests" -Status "SKIP" -Message "Module Crashed: $_"
        }
    }

    Write-Progress -Activity "Verifying $($addons.Count) Add-ons" -Completed
}
catch {
    Write-Host "X ERROR: $($_.Exception.Message)" -ForegroundColor Red
    $global:GlobalFailed = $true
}
finally {

    # --- SUMMARY ---
    # Only show summary header if results exist or specific addons targeted
    if ($global:Results -or ("all" -notin $Addon)) {
        Write-Header "EXECUTION SUMMARY"
        $SummaryResults = $global:Results
        if ("all" -notin $Addon -or $ChangedOnly) {
            if ($SummaryResults) {
                # Ensure we have $addons variable populated even if execution failed halfway, though scope might be tricky
                # If $addons is null, show all results
                if ($addons) {
                    $SummaryResults = $SummaryResults | Where-Object { $_.Addon -in $addons.Name -or $_.Addon -match "Global|Workflows" }
                }
            }
        }
        $SummaryResults | Format-Table -AutoSize
    }

    # Statistics
    $PassCount = if ($global:Results) { ($global:Results | Where-Object { $_.Status -eq "PASS" }).Count } else { 0 }
    $FailCount = if ($global:Results) { ($global:Results | Where-Object { $_.Status -eq "FAIL" }).Count } else { 0 }
    $WarnCount = if ($global:Results) { ($global:Results | Where-Object { $_.Status -eq "WARN" }).Count } else { 0 }
    $SkipCount = if ($global:Results) { ($global:Results | Where-Object { $_.Status -eq "SKIP" }).Count } else { 0 }

    Write-Host ""
    Write-Host ""
    Write-Host ""
    # Safe Box Drawing & Emojis
    $c_ul = [char]0x250C; $c_h = [char]0x2500; $c_ur = [char]0x2510
    $c_v  = [char]0x2502; $c_l = [char]0x251C; $c_r  = [char]0x2524
    $c_bl = [char]0x2514; $c_br = [char]0x2518

    # Emojis (Surrogates handling)
    $e_chart = "$([char]0xD83D)$([char]0xDCCA)" # 📊
    $e_pass  = "$([char]0x2705)"                 # ✅
    $e_fail  = "$([char]0x274C)"                 # ❌
    $e_warn  = "$([char]0x26A0)$([char]0xFE0F)"  # ⚠️
    $e_skip  = "$([char]0x23ED)$([char]0xFE0F)"  # ⏭️

    $line_top = "$c_ul$("$c_h" * 37)$c_ur"
    $line_mid = "$c_l$("$c_h" * 37)$c_r"
    $line_bot = "$c_bl$("$c_h" * 37)$c_br"

    Write-Host ""
    Write-Host "  $line_top" -ForegroundColor Gray
    Write-Host "  $c_v           $e_chart STATISTICS             $c_v" -ForegroundColor Gray
    Write-Host "  $line_mid" -ForegroundColor Gray
    Write-Host "  $c_v  $e_pass  Passed:   " -NoNewline -ForegroundColor Gray
    Write-Host ("{0,5}" -f $PassCount) -NoNewline -ForegroundColor Green
    Write-Host "                $c_v" -ForegroundColor Gray
    Write-Host "  $c_v  $e_fail  Failed:   " -NoNewline -ForegroundColor Gray
    Write-Host ("{0,5}" -f $FailCount) -NoNewline -ForegroundColor $(if ($FailCount -gt 0) { "Red" } else { "Gray" })
    Write-Host "                $c_v" -ForegroundColor Gray
    Write-Host "  $c_v  $e_warn  Warnings: " -NoNewline -ForegroundColor Gray
    Write-Host ("{0,5}" -f $WarnCount) -NoNewline -ForegroundColor $(if ($WarnCount -gt 0) { "Yellow" } else { "Gray" })
    Write-Host "                $c_v" -ForegroundColor Gray
    Write-Host "  $c_v  $e_skip  Skipped:  " -NoNewline -ForegroundColor Gray
    Write-Host ("{0,5}" -f $SkipCount) -NoNewline -ForegroundColor DarkGray
    Write-Host "                $c_v" -ForegroundColor Gray
    Write-Host "  $line_bot" -ForegroundColor Gray

    if ($global:GlobalFailed) {
        Write-Host ""
        Write-Host "  $e_fail Verification FAILED!" -ForegroundColor Red
    }
    else {
        Write-Host ""
        Write-Host "  $e_pass Verification PASSED!" -ForegroundColor Green
    }

    # Export results
    if ($JsonFile) {
        $global:Results | ConvertTo-Json -Depth 10 -Compress:$false | Out-File -FilePath $JsonFile -Encoding UTF8
        Write-Host "Results saved to: $JsonFile" -ForegroundColor Gray
    }

    # --- CLEANUP & ROTATION ---
    Write-Host "Cleaning up..." -ForegroundColor Gray

    # 1. Remove Temp Files
    if (Test-Path $OutputDir) {
        $oldProgress = $ProgressPreference
        $ProgressPreference = "SilentlyContinue"
        try {
            Get-ChildItem -Path $OutputDir -Filter "tmp_*" -Directory | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        }
        finally {
            $ProgressPreference = $oldProgress
        }
    }

    # 2. Log Retention (Max 10 files, Max 30 Days)
    $retentionCount = 10
    $retentionDays = 30
    $limitDate = (Get-Date).AddDays(-$retentionDays)

    function Clean-Files {
        param($filter)
        $files = Get-ChildItem -Path $OutputDir -Filter $filter | Sort-Object LastWriteTime -Descending

        # Delete older than 30 days
        $files | Where-Object { $_.LastWriteTime -lt $limitDate } | Remove-Item -Force

        # Re-fetch and cap at 10
        $files = Get-ChildItem -Path $OutputDir -Filter $filter | Sort-Object LastWriteTime -Descending
        if ($files.Count -gt $retentionCount) {
            $files | Select-Object -Skip $retentionCount | Remove-Item -Force
        }
    }

    if (Test-Path $OutputDir) {
        Clean-Files "verify_log_*.txt"
        Clean-Files "verification_results_*.json"
    }

    try { Stop-Transcript | Out-Null } catch {}

    $ScriptEndTime = Get-Date
    $Duration = $ScriptEndTime - $ScriptStartTime
    Write-Host ""
    Write-Host "Finished at: $($ScriptEndTime.ToString())" -ForegroundColor Cyan
    Write-Host "Duration: $($Duration.ToString())" -ForegroundColor Cyan

    # Final Notification
    $finalStatus = if ($global:GlobalFailed) { "$e_fail Failed" } else { "$e_pass Passed" }
    $stats = "P: $PassCount, F: $FailCount, W: $WarnCount, S: $SkipCount"
    Show-Notification -Title "Verification $finalStatus" -Message "$stats | Duration: $($Duration.ToString())" -LogPath $LogFile

    if ($global:GlobalFailed) { exit 1 } else { exit 0 }
}
