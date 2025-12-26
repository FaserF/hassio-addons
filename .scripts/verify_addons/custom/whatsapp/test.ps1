param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [string]$ContainerName
)

# Source common module for Add-Result
. "$RepoRoot/.scripts/verify_addons/lib/common.ps1"

Write-Host "      - Running WhatsApp Specific Checks..." -ForegroundColor Gray

# 1. Check if we have a running container to reuse
$containerRunning = $false
if ($ContainerName) {
    if (docker ps -q -f name=$ContainerName) {
        $containerRunning = $true
    }
}

if (-not $containerRunning) {
   Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "SKIP" -Message "Docker container not available for reuse."
   return
}

# 2. Test: Verify Health Endpoint
# The addon starts a web server on port 8066
Write-Host "      - Verifying health endpoint (http://127.0.0.1:8066/)..." -ForegroundColor Gray

# Wait loop (up to 30 seconds)
$healthPassed = $false
for ($i = 0; $i -lt 24; $i++) {
    # Attempt curl inside container
    $curlResult = docker exec $ContainerName curl -f -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8066/ 2>$null
    $curlResult = $curlResult.Trim()

    # Write-Host "DEBUG: Curl result: '$curlResult'" -ForegroundColor DarkGray

    if ($curlResult -eq "200" -or $curlResult -eq "404" -or $curlResult -eq "401") {
        # 200 = OK.
        if ($curlResult -eq "200") {
             $healthPassed = $true
             break
        }
    }
    Start-Sleep -Seconds 5
}

if ($healthPassed) {
    Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "PASS" -Message "WhatsApp Health Endpoint verified (200 OK)"
} else {
    # One last check: is the process even running?
    $processes = docker exec $ContainerName ps aux 2>$null

    # PowerShell -match on array returns matches. If array is empty, it's false.
    $nodeProcesses = $processes -match "node"

    if (-not $nodeProcesses) {
         Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "FAIL" -Message "Node process not found in container. Processes: $($processes -join ', ')"
    } else {
         Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "FAIL" -Message "Health endpoint not reachable after 30s. Last Code: '$curlResult'"
    }
}
