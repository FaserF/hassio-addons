<#
.SYNOPSIS
    Common functions and utilities for the verify_addons test suite.

.DESCRIPTION
    This module contains shared functions used across all test stages:
    - Result tracking and output formatting
    - Docker availability checking
    - YAML/config file parsing helpers
    - Test filtering logic

    This module is sourced by the main orchestrator and all test files.
#>

# --- GLOBAL STATE ---
# Results array (shared across all test files)
if ($null -eq $global:Results) { $global:Results = @() }
if ($null -eq $global:GlobalFailed) { $global:GlobalFailed = $false }

# --- RESULT TRACKING ---
function Add-Result {
    <#
    .SYNOPSIS
        Records a test result and outputs colored status message.
    .PARAMETER Addon
        Name of the addon being tested.
    .PARAMETER Check
        Name of the check/test.
    .PARAMETER Status
        Result status: PASS, FAIL, WARN, SKIP, INFO
    .PARAMETER Message
        Descriptive message about the result.
    #>
    param(
        [Parameter(Mandatory)][string]$Addon,
        [Parameter(Mandatory)][string]$Check,
        [Parameter(Mandatory)][string]$Status,
        [string]$Message = ""
    )

    # Check if this addon is unsupported to give a hint
    $checkRoot = if (Get-Variable -Name RepoRoot -ValueOnly -ErrorAction SilentlyContinue) { $RepoRoot } else { "." }
    if (Test-Path (Join-Path $checkRoot ".unsupported\$Addon")) {
        $Addon = "$Addon (Unsupported)"
    }

    $obj = [PSCustomObject]@{
        Addon   = $Addon
        Check   = $Check
        Status  = $Status
        Message = $Message
    }
    $global:Results += $obj

    $iconFail = [char]0x274C
    $iconWarn = [char]0x26A0
    $iconSkip = [char]0x23ED
    $iconInfo = [char]0x2139
    $iconPass = [char]0x2705

    switch ($Status) {
        "FAIL" {
            Write-Host "  $iconFail [FAIL] $Addon : $Check" -ForegroundColor Red
            if ($Message) { Write-Host "           $Message" -ForegroundColor Red }
            $global:GlobalFailed = $true

            # Send Notification
            if ($global:LogFile) {
                Show-Notification -Title "❌ $Addon : $Check Failed" -Message "$Message" -LogPath $global:LogFile
            }
        }
        "WARN" {
            Write-Host "  $iconWarn  [WARN] $Addon : $Check" -ForegroundColor Yellow
            if ($Message) { Write-Host "           $Message" -ForegroundColor Yellow }
        }
        "SKIP" {
            Write-Host "  $iconSkip  [SKIP] $Addon : $Check ($Message)" -ForegroundColor DarkGray
        }
        "INFO" {
            Write-Host "  $iconInfo  [INFO] $Addon : $Check - $Message" -ForegroundColor Cyan
        }
        default {
            Write-Host "  $iconPass [PASS] $Addon : $Check" -ForegroundColor Green
        }
    }
}

# --- NOTIFICATIONS ---
function Show-Notification {
    <#
    .SYNOPSIS
        Sends a Windows Toast Notification.
    #>
    param(
        [string]$Title,
        [string]$Message,
        [string]$LogPath
    )

    if (-not $IsWindows -or $env:GITHUB_ACTIONS) { return }

    # Constraint: Skip on PowerShell 5 (Desktop) as requested
    if ($PSVersionTable.PSVersion.Major -lt 6) {
        Write-Host "  ! NOTE: Windows Notifications skipped on PowerShell 5." -ForegroundColor DarkGray
        return
    }

    try {
        # PS5/Legacy check: Try to load WinRT types if possible, or fail gracefully
        $xmlType = [Type]::GetType("Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType=WindowsRuntime")
        $toastType = [Type]::GetType("Windows.UI.Notifications.ToastNotification, Windows.UI.Notifications, ContentType=WindowsRuntime")
        $notifierType = [Type]::GetType("Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType=WindowsRuntime")

        if (-not $xmlType -or -not $toastType -or -not $notifierType) {
            # Fallback: Powershell 7 / Core requires 'BurntToast' module
            try {
                if (-not (Get-Module -ListAvailable BurntToast)) {
                    Write-Host "  ! NOTE: Installing 'BurntToast' module for notifications (Scope: CurrentUser)..." -ForegroundColor Yellow
                    Install-Module BurntToast -Scope CurrentUser -Force -ErrorAction Stop
                }

                # Import if needed
                if (-not (Get-Module BurntToast)) { Import-Module BurntToast -ErrorAction Stop }

                # Send Notification using BurntToast
                $btn = New-BurntToastButton -Content "Open Log File" -Argument $LogPath -ActivationType Protocol
                New-BurntToastNotification -Text $Title, $Message -Button $btn -AppLogo "https://raw.githubusercontent.com/home-assistant/assets/master/logo/logo.png" -Silent
                return
            } catch {
                Write-Host "  ! NOTE: Notifications on PS7 require 'BurntToast'." -ForegroundColor DarkGray
                Write-Host "    Install manually: Install-Module BurntToast -Scope CurrentUser" -ForegroundColor DarkGray
                return
            }
        }

        $template = @"
<toast>
    <visual>
        <binding template='ToastGeneric'>
            <text>$Title</text>
            <text>$Message</text>
        </binding>
    </visual>
    <actions>
        <action activationType='protocol' arguments='$LogPath' content='Open Log File'/>
    </actions>
</toast>
"@

        $xml = [Activator]::CreateInstance($xmlType)
        $xml.LoadXml($template)
        $toast = [Activator]::CreateInstance($toastType, $xml)
        $notifier = $notifierType::CreateToastNotifier("HA Addon Verify")
        $notifier.Show($toast)
    } catch {
        Write-Host "  ! NOTE: Notification failed to send: $($_.Exception.Message)" -ForegroundColor DarkGray
    }
}

function Check-ForUpdates {
    param(
        [string]$CurrentVersion,
        [string]$CacheDir
    )

    $checkFile = Join-Path $CacheDir ".last_update_check"

    # daily check
    if (Test-Path $checkFile) {
        $lastCheck = Get-Date (Get-Content $checkFile)
        if ((Get-Date) -lt $lastCheck.AddHours(24)) { return }
    }

    Write-Host "  Checking for updates..." -ForegroundColor Gray

    $url = "https://raw.githubusercontent.com/FaserF/hassio-addons/master/.scripts/verify_addons/config/test-config.yaml"
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop -TimeoutSec 5
        $content = $response.Content

        # Simple regex to extract version to avoid yaml parsing dependency here
        if ($content -match 'scriptVersion:\s*"([\d\.]+)"') {
            $remoteVer = [version]$matches[1]
            $localVer = [version]$CurrentVersion

            if ($remoteVer -gt $localVer) {
                Write-Host "  ! UPDATE AVAILABLE: v$remoteVer is available (Current: v$localVer)" -ForegroundColor Magenta
                Write-Host "    Download at: https://github.com/FaserF/hassio-addons" -ForegroundColor Magenta

                if (Get-Command Show-Notification -ErrorAction SilentlyContinue) {
                    Show-Notification -Title "Update Available 🚀" -Message "New version v$remoteVer is available! (Current: v$localVer)" -LogPath "https://github.com/FaserF/hassio-addons"
                }
            } else {
                 Write-Host "  (Up to date)" -ForegroundColor DarkGray
            }
        } else {
             Write-Host "  (Could not parse remote version)" -ForegroundColor DarkGray
        }

        Set-Content -Path $checkFile -Value (Get-Date).ToString() -Force
    } catch {
        # 404 or Network Error
        Write-Host "  (Update check skipped: Remote config unavailable)" -ForegroundColor DarkGray
    }
}

# --- OUTPUT FORMATTING ---
function Write-Header {
    <#
    .SYNOPSIS
        Writes a formatted section header.
    #>
    param([Parameter(Mandatory)][string]$Message)
    Write-Host ""
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "  $('-' * $Message.Length)" -ForegroundColor DarkGray
    Write-Host ""
}

# --- DOCKER UTILITIES ---
function Check-Docker {
    <#
    .SYNOPSIS
        Checks if Docker is available and running.
    .DESCRIPTION
        On Windows, attempts to start Docker Desktop if not running.
    .OUTPUTS
        Boolean indicating Docker availability.
    #>
    Write-Host "Checking Docker..." -ForegroundColor Gray
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -eq 0 -and $dockerInfo -match "Server Version") { return $true }

    if ($IsWindows) {
        if (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue) {
            Write-Host "Docker Desktop running but not responsive..." -ForegroundColor Gray
        }
        else {
            $dockerExe = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
            if (Test-Path $dockerExe) {
                Write-Host "Starting Docker Desktop..." -ForegroundColor Gray
                Start-Process $dockerExe
                for ($i = 0; $i -lt 60; $i++) {
                    Start-Sleep -Seconds 2
                    $info = docker info 2>&1
                    if ($LASTEXITCODE -eq 0 -and $info -match "Server Version") { return $true }
                    Write-Host -NoNewline "."
                }
            }
        }
    }
    return $false
}

# --- YAML/CONFIG PARSING HELPERS ---
function Get-BuildFrom {
    <#
    .SYNOPSIS
        Extracts the amd64 base image from build.yaml.
    .PARAMETER Path
        Path to build.yaml file.
    .OUTPUTS
        Base image string or $null.
    #>
    param([Parameter(Mandatory)][string]$Path)

    $script = @'
import sys, yaml
try:
  print(yaml.safe_load(open(sys.argv[1])).get("build_from", {}).get("amd64", ""))
except:
  print("")
'@
    try {
        $pathArg = $Path.Replace('\','/')
        $res = python -c $script $pathArg 2>&1
        if ($LASTEXITCODE -eq 0) { return $res.Trim() }
        return $null
    }
    catch { return $null }
}

function Get-DefaultOptions {
    <#
    .SYNOPSIS
        Extracts the 'options' key from config.yaml as JSON.
    .PARAMETER Path
        Path to config.yaml file.
    .OUTPUTS
        JSON string of options or "{}".
    #>
    param([Parameter(Mandatory)][string]$Path)

    $script = @'
import sys, yaml, json
try:
  print(json.dumps(yaml.safe_load(open(sys.argv[1])).get("options", {})))
except:
  print("{}")
'@
    try {
        $pathArg = $Path.Replace('\','/')
        $json = python -c $script $pathArg 2>&1
        $res = $json | Out-String
        if ($LASTEXITCODE -eq 0 -and $res -match '^\s*\{.*\}\s*$') { return $res.Trim() }
        return "{}"
    }
    catch { return "{}" }
}

function Get-RequiredSchemaKeys {
    <#
    .SYNOPSIS
        Extracts required keys from schema (those NOT ending with ?).
    .PARAMETER Path
        Path to config.yaml file.
    .OUTPUTS
        Comma-separated string of required key names.
    #>
    param([Parameter(Mandatory)][string]$Path)

    $script = @'
import sys, yaml
try:
  conf = yaml.safe_load(open(sys.argv[1]))
  keys = []
  for k,v in conf.get("schema", {}).items():
    if isinstance(v, str) and not v.endswith("?"):
      keys.append(k)
  print(",".join(keys))
except:
  print("")
'@
    try {
        $pathArg = $Path.Replace('\','/')
        $res = python -c $script $pathArg 2>&1
        if ($LASTEXITCODE -eq 0) { return $res.Trim() }
        return ""
    }
    catch { return "" }
}

# --- TEST FILTERING ---
function Should-RunTest {
    <#
    .SYNOPSIS
        Determines if a test should run for a specific addon.
    .DESCRIPTION
        In ChangedOnly mode, docs-only changes only run docs tests.
    .PARAMETER AddonName
        Name of the addon.
    .PARAMETER TestName
        Name of the test.
    .PARAMETER ChangedOnly
        Whether ChangedOnly mode is active.
    .PARAMETER ChangedAddons
        Hashtable of changed addons and their change type.
    .PARAMETER DocsOnlyTests
        Array of tests allowed for docs-only changes.
    #>
    param(
        [Parameter(Mandatory)][string]$AddonName,
        [Parameter(Mandatory)][string]$TestName,
        [bool]$ChangedOnly = $false,
        [hashtable]$ChangedAddons = @{},
        [string[]]$DocsOnlyTests = @("MarkdownLint", "Prettier", "LineEndings")
    )

    # If not in ChangedOnly mode, or if it's a code change, run everything requested
    if (-not $ChangedOnly -or $ChangedAddons[$AddonName] -eq "Code") {
        return $true
    }

    # If it's only a Doc change, only run docs tests
    if ($TestName -in $DocsOnlyTests) {
        return $true
    }

    return $false
}

# --- YAML CONFIG LOADER ---
function Get-TestConfig {
    <#
    .SYNOPSIS
        Loads the test configuration from YAML file.
    .PARAMETER ConfigPath
        Path to test-config.yaml file.
    .OUTPUTS
        Hashtable with configuration values.
    #>
    param([string]$ConfigPath)

    # Default values (fallback if YAML parsing fails)
    $defaults = @{
        latestBase = "19.0.0"
        latestDebian = "9.1.0"
        latestPython = "3.13-alpine3.21"
        latestNode = "24.12.0"
        builderImage = "ghcr.io/home-assistant/amd64-builder:2025.11.0"
        scriptVersion = "2.1.0"
        validTests = @("all", "LineEndings", "ShellCheck", "Hadolint", "YamlLint", "MarkdownLint", "Prettier", "AddonLinter", "Compliance", "Trivy", "VersionCheck", "DockerBuild", "DockerRun", "CodeRabbit", "WorkflowChecks")
        dockerTests = @("Hadolint", "AddonLinter", "Trivy", "DockerBuild", "DockerRun", "WorkflowChecks")
        docsOnlyTests = @("MarkdownLint", "Prettier", "LineEndings")
    }

    if (-not $ConfigPath -or -not (Test-Path $ConfigPath)) {
        return $defaults
    }

    try {
        # Try to use powershell-yaml module if available
        if (Get-Module -ListAvailable -Name powershell-yaml) {
            Import-Module powershell-yaml -ErrorAction Stop
            $config = Get-Content $ConfigPath -Raw | ConvertFrom-Yaml
            # Merge with defaults for any missing keys
            foreach ($key in $defaults.Keys) {
                if (-not $config.ContainsKey($key)) {
                    $config[$key] = $defaults[$key]
                }
            }
            return $config
        }

        # Fallback: Parse YAML manually for simple key:value pairs
        $config = @{}
        $content = Get-Content $ConfigPath
        $currentArray = $null
        $currentKey = $null

        foreach ($line in $content) {
            # Skip comments and empty lines
            if ($line -match '^\s*#' -or $line -match '^\s*$') { continue }

            # Array item
            if ($line -match '^\s*-\s+(.+)$') {
                if ($currentKey -and $currentArray -ne $null) {
                    $currentArray += $matches[1].Trim('"', "'")
                }
            }
            # Key: value
            elseif ($line -match '^(\w+):\s*"?([^"]+)"?\s*$') {
                if ($currentKey -and $currentArray -ne $null) {
                    $config[$currentKey] = $currentArray
                }
                $currentKey = $matches[1]
                $value = $matches[2].Trim()
                if ($value) {
                    $config[$currentKey] = $value
                    $currentArray = $null
                } else {
                    $currentArray = @()
                }
            }
            # Key with array start
            elseif ($line -match '^(\w+):\s*$') {
                if ($currentKey -and $currentArray -ne $null) {
                    $config[$currentKey] = $currentArray
                }
                $currentKey = $matches[1]
                $currentArray = @()
            }
        }
        # Save last array
        if ($currentKey -and $currentArray -ne $null) {
            $config[$currentKey] = $currentArray
        }

        # Merge with defaults
        foreach ($key in $defaults.Keys) {
            if (-not $config.ContainsKey($key)) {
                $config[$key] = $defaults[$key]
            }
        }
        return $config
    }
    catch {
        Write-Warning "Failed to parse config file, using defaults: $_"
        return $defaults
    }
}

# Export functions for module usage
