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
    if ($env:GITHUB_ACTIONS) {
        # CI environment has Docker pre-installed and running
        return $true
    }

    if ($IsWindows) {
        # Check if Docker Desktop is even installed
        $dockerPath = where.exe docker 2>$null
        if (-not $dockerPath) { return $false }

        Write-Host "Checking Docker..." -ForegroundColor Gray
        # Use a short timeout for the check to avoid hangs
        $dockerCheck = docker version --format '{{.Server.Version}}' 2>$null | Out-String
        if ($LASTEXITCODE -eq 0 -and $dockerCheck.Trim()) { return $true }

        Write-Host "Docker is not running. Attempting to start Docker Desktop..." -ForegroundColor Yellow
        $dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dockerDesktop) {
            Start-Process $dockerDesktop -ErrorAction SilentlyContinue
            Write-Host "Waiting for Docker to start (up to 30s)..." -ForegroundColor Gray
            for ($i = 0; $i -lt 30; $i++) {
                Start-Sleep -Seconds 1
                $info = docker version --format '{{.Server.Version}}' 2>$null | Out-String
                if ($LASTEXITCODE -eq 0 -and $info.Trim()) {
                    Write-Host "Docker started!" -ForegroundColor Green
                    return $true
                }
                Write-Host -NoNewline "."
            }
            Write-Host ""
        }
    } else {
        # Linux/macOS simple check
        docker version --format '{{.Server.Version}}' 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { return $true }
    }
    return $false
}

# --- YAML/CONFIG PARSING HELPERS ---
function Get-AddonAttributes {
    <#
    .SYNOPSIS
        Extracts various attributes (privileged, host_network, full_access) from config.yaml.
    #>
    param([Parameter(Mandatory)][string]$Path)
    $res = @{
        Privileged = $false
        HostNetwork = $false
        Caps = @()
    }
    if (-not (Test-Path $Path)) { return $res }

    $content = Get-Content $Path
    $inPrivileged = $false
    foreach ($line in $content) {
        # Simple flags
        if ($line -match '^privileged:\s*true\s*$') { $res.Privileged = $true }
        if ($line -match '^host_network:\s*true\s*$') { $res.HostNetwork = $true }
        if ($line -match '^full_access:\s*true\s*$') { $res.Privileged = $true }

        # Start of privileged list
        if ($line -match '^privileged:\s*$') { $inPrivileged = $true; continue }
        if ($line -match '^\w+:') { $inPrivileged = $false }

        if ($inPrivileged -and $line -match '^\s*-\s+(\w+)') {
            $cap = $matches[1]
            if ($cap -eq "NET_ADMIN") { $res.Privileged = $true }
            $res.Caps += $cap
        }
    }
    return $res
}

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
        latestBase = ""
        latestDebian = ""
        latestPython = ""
        latestNode = ""
        builderImage = ""
        scriptVersion = ""
        validTests = @("all", "LineEndings", "ShellCheck", "Hadolint", "YamlLint", "MarkdownLint", "Prettier", "AddonLinter", "Compliance", "Trivy", "VersionCheck", "DockerBuild", "DockerRun", "CodeRabbit", "WorkflowChecks", "PythonChecks")
        dockerTests = @("Hadolint", "AddonLinter", "Trivy", "DockerBuild", "DockerRun", "WorkflowChecks")
        docsOnlyTests = @("MarkdownLint", "Prettier", "LineEndings")
        testWeights = @{
            LineEndings = 0.2; ShellCheck = 1.0; Hadolint = 3.0; YamlLint = 0.5
            MarkdownLint = 0.5; Prettier = 1.5; AddonLinter = 10.0; Compliance = 1.0
            Trivy = 60.0; VersionCheck = 1.0; DockerBuild = 180.0; DockerRun = 60.0
            CodeRabbit = 1.0; WorkflowChecks = 2.0; AutoFix = 3.0; PythonChecks = 1.0
        }
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
    } catch {
        Write-Warning "Failed to parse config file with YAML parser: $_"
    }

    # Fallback: Parse YAML manually with Regex (Robust for simple key: value)
    Write-Host "Using regex fallback to parse config..." -ForegroundColor DarkGray
    $config = @{}
    $content = Get-Content $ConfigPath -Raw

    # Extract simple string keys
    if ($content -match 'latestBase: "([^"]+)"') { $config.latestBase = $matches[1] }
    if ($content -match 'latestDebian: "([^"]+)"') { $config.latestDebian = $matches[1] }
    if ($content -match 'latestPython: "([^"]+)"') { $config.latestPython = $matches[1] }
    if ($content -match 'latestNode: "([^"]+)"') { $config.latestNode = $matches[1] }
    if ($content -match 'builderImage: "([^"]+)"') { $config.builderImage = $matches[1] }
    if ($content -match 'scriptVersion: "([^"]+)"') { $config.scriptVersion = $matches[1] }

    # Mock versions
    if ($content -match 'mockCoreVersion: "([^"]+)"') { $config.mockCoreVersion = $matches[1] }
    if ($content -match 'mockSupervisorVersion: "([^"]+)"') { $config.mockSupervisorVersion = $matches[1] }
    if ($content -match 'mockOsVersion: "([^"]+)"') { $config.mockOsVersion = $matches[1] }
    if ($content -match 'mockKernelVersion: "([^"]+)"') { $config.mockKernelVersion = $matches[1] }
    if ($content -match 'mockArch: "([^"]+)"') { $config.mockArch = $matches[1] }

    # Merge defaults for arrays/hashtables which are hard to regex
    foreach ($key in $defaults.Keys) {
        if (-not $config.ContainsKey($key)) {
            $config[$key] = $defaults[$key]
        }
    }

    return $config

}

# Export functions for module usage
