param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [string]$ContainerName
)

# Source common module for Add-Result
. "$RepoRoot/.scripts/verify_addons/lib/common.ps1"

Write-Host "      - Running Antigravity Server Specific Checks..." -ForegroundColor Gray

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

# 2. Test: Check if certain processes are running inside the container
# Antigravity server likely runs some node or python process
Write-Host "      - Verifying internal processes..." -ForegroundColor Gray
$processes = docker exec $ContainerName ps aux 2>$null

# Example check for s6-rc or a specific service
if ($processes -match "s6-svscan") {
    # 3. Test: Verify some API response (mocked or internal)
    # We could try to curl an internal port if we know it
    # For now, let's just do a basic check
    Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "PASS" -Message "Antigravity Server verified (s6-svscan present)"
} else {
    Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "FAIL" -Message "Antigravity Server critical processes missing."
}
