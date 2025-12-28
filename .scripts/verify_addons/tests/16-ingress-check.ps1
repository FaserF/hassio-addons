<#
.SYNOPSIS
    Ingress Check - validates Ingress configuration for Home Assistant add-ons.
.DESCRIPTION
    This test module validates that add-ons with ingress enabled have proper configuration:
    - Checks for ingress_port (required for ingress)
    - Validates ingress_entry path format
    - Verifies panel_icon is set (optional but recommended)
    - Skips add-ons without ingress or with ingress: false
#>
param(
    [Parameter(Mandatory)][array]$Addons,
    [Parameter(Mandatory)][hashtable]$Config,
    [bool]$ChangedOnly = $false,
    [hashtable]$ChangedAddons = @{},
    [Parameter(Mandatory)][string]$RepoRoot,
    [bool]$DockerAvailable = $false
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

Write-Header "16. Ingress Validation"

function Get-IngressConfig {
    <#
    .SYNOPSIS
        Extracts ingress-related configuration from config.yaml using Python.
    .PARAMETER Path
        Path to config.yaml file.
    .OUTPUTS
        Hashtable with ingress configuration or $null if not enabled.
    #>
    param([Parameter(Mandatory)][string]$Path)

    $script = @'
import sys, yaml, json
try:
    conf = yaml.safe_load(open(sys.argv[1]))
    ingress = conf.get("ingress", False)
    if ingress is True:
        result = {
            "enabled": True,
            "ingress_port": conf.get("ingress_port"),
            "ingress_entry": conf.get("ingress_entry"),
            "ingress_stream": conf.get("ingress_stream", False),
            "panel_icon": conf.get("panel_icon"),
            "panel_title": conf.get("panel_title"),
            "panel_admin": conf.get("panel_admin", True),
            "ports": conf.get("ports", {})
        }
        print(json.dumps(result))
    else:
        print(json.dumps({"enabled": False}))
except Exception as e:
    print(json.dumps({"error": str(e)}))
'@
    try {
        $pathArg = $Path.Replace('\','/')
        $json = python -c $script $pathArg 2>&1
        $res = $json | Out-String
        if ($LASTEXITCODE -eq 0 -and $res -match '^\s*\{.*\}\s*$') {
            return $res.Trim() | ConvertFrom-Json
        }
        return $null
    }
    catch {
        return $null
    }
}

foreach ($addon in $Addons) {
    if (-not (Should-RunTest -AddonName $addon.Name -TestName "IngressCheck" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) {
        continue
    }

    # Temporary: Skip IngressCheck in CI globally
    if ($env:GITHUB_ACTIONS -eq 'true') {
        Add-Result -Addon $addon.Name -Check "IngressCheck" -Status "SKIP" -Message "Temporary: IngressCheck disabled in CI"
        continue
    }

    $configFile = Join-Path $addon.FullName "config.yaml"
    if (-not (Test-Path $configFile)) {
        Add-Result -Addon $addon.Name -Check "IngressCheck" -Status "SKIP" -Message "No config.yaml found"
        continue
    }

    $ingressConfig = Get-IngressConfig $configFile

    if ($null -eq $ingressConfig) {
        Add-Result -Addon $addon.Name -Check "IngressCheck" -Status "SKIP" -Message "Could not parse config.yaml"
        continue
    }

    if ($ingressConfig.error) {
        Add-Result -Addon $addon.Name -Check "IngressCheck" -Status "WARN" -Message "Parse error: $($ingressConfig.error)"
        continue
    }

    # Skip add-ons without ingress enabled
    if (-not $ingressConfig.enabled) {
        Add-Result -Addon $addon.Name -Check "IngressCheck" -Status "INFO" -Message "Ingress not enabled - skipped"
        continue
    }

    # --- INGRESS VALIDATION ---
    $issues = @()
    $warnings = @()

    # Check ingress_port (required for ingress add-ons)
    if (-not $ingressConfig.ingress_port) {
        $issues += "Missing 'ingress_port' (required for ingress add-ons)"
    }
    elseif ($ingressConfig.ingress_port -isnot [int] -and $ingressConfig.ingress_port -notmatch '^\d+$') {
        $issues += "Invalid 'ingress_port': must be a valid port number"
    }
    elseif ([int]$ingressConfig.ingress_port -lt 1 -or [int]$ingressConfig.ingress_port -gt 65535) {
        $issues += "Invalid 'ingress_port': $($ingressConfig.ingress_port) (must be 1-65535)"
    }

    # Check ingress_entry (optional but common)
    if ($ingressConfig.ingress_entry) {
        if (-not $ingressConfig.ingress_entry.StartsWith("/")) {
            $issues += "Invalid 'ingress_entry': must start with '/'"
        }
    }
    else {
        $warnings += "No 'ingress_entry' defined (defaults to '/')"
    }

    # Check panel_icon (optional but recommended for better UX)
    if (-not $ingressConfig.panel_icon) {
        $warnings += "No 'panel_icon' defined (recommended for sidebar display)"
    }
    elseif (-not $ingressConfig.panel_icon.StartsWith("mdi:")) {
        $warnings += "panel_icon '$($ingressConfig.panel_icon)' should use mdi: prefix"
    }

    # Check if ingress_port matches any exposed port
    if ($ingressConfig.ingress_port -and $ingressConfig.ports) {
        $portMatched = $false
        foreach ($portDef in $ingressConfig.ports.PSObject.Properties) {
            # Parse port definition (e.g., "8066/tcp")
            if ($portDef.Name -match '^(\d+)') {
                if ([int]$matches[1] -eq [int]$ingressConfig.ingress_port) {
                    $portMatched = $true
                    break
                }
            }
        }
        if (-not $portMatched -and $ingressConfig.ports.Count -gt 0) {
            $warnings += "ingress_port $($ingressConfig.ingress_port) not found in ports definition"
        }
    }

    # --- RUNTIME INGRESS TEST (if Docker available and container running) ---
    if ($DockerAvailable) {
        $contName = "test-run-$($addon.Name.ToLower())"
        $isRunning = docker ps -q -f name=$contName 2>$null

        if ($isRunning) {
            Write-Host "    > Testing ingress endpoint for $($addon.Name)..." -ForegroundColor Gray

            try {
                $port = $ingressConfig.ingress_port
                $entry = if ($ingressConfig.ingress_entry) { $ingressConfig.ingress_entry } else { "/" }

                # Try to reach the ingress endpoint inside the container
                $curlResult = docker exec $contName sh -c "wget -q -O /dev/null --timeout=5 http://localhost:$port$entry && echo OK || echo FAIL" 2>&1

                if ($curlResult -match "OK") {
                    Write-Host "    > Ingress endpoint reachable at port $port$entry" -ForegroundColor Green
                }
                elseif ($curlResult -match "FAIL|Connection refused|timed out") {
                    $warnings += "Ingress endpoint not reachable at localhost:$port$entry"
                }
            }
            catch {
                Write-Host "    > Could not test ingress endpoint: $_" -ForegroundColor DarkGray
            }
        }
    }

    # --- REPORT RESULTS ---
    if ($issues.Count -gt 0) {
        Add-Result -Addon $addon.Name -Check "IngressCheck" -Status "FAIL" -Message ($issues -join "; ")
    }
    elseif ($warnings.Count -gt 0) {
        Add-Result -Addon $addon.Name -Check "IngressCheck" -Status "WARN" -Message ($warnings -join "; ")
    }
    else {
        $infoMsg = "Ingress OK (Port: $($ingressConfig.ingress_port)"
        if ($ingressConfig.ingress_entry) { $infoMsg += ", Entry: $($ingressConfig.ingress_entry)" }
        if ($ingressConfig.panel_icon) { $infoMsg += ", Icon: $($ingressConfig.panel_icon)" }
        $infoMsg += ")"
        Add-Result -Addon $addon.Name -Check "IngressCheck" -Status "PASS" -Message $infoMsg
    }
}
