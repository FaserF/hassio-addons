param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [Parameter(Mandatory)]$ContainerName
)
Write-Host "    > [Custom] Verifying N8n..." -ForegroundColor Gray

$logs = docker logs "$ContainerName" 2>&1

# Check for banner (indicates addon started)
if ($logs -match "FaserF's Addon Repository") {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "PASS" -Message "Banner found."
} else {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "FAIL" -Message "Banner not found in container logs."
}

# Check for N8n startup messages
if ($logs -match "Starting N8n" -or $logs -match "n8n ready") {
    Add-Result -Addon $Addon.Name -Check "StartupCheck" -Status "PASS" -Message "N8n startup message found."
} elseif ($logs -match "Could not resolve host: supervisor") {
    Add-Result -Addon $Addon.Name -Check "StartupCheck" -Status "INFO" -Message "Supervisor connection required - expected in mock environment."
} else {
    Add-Result -Addon $Addon.Name -Check "StartupCheck" -Status "WARN" -Message "N8n startup message not found in logs."
}

# Check if n8n process is running (if container is still alive)
$containerRunning = docker inspect -f '{{.State.Running}}' "$ContainerName" 2>&1
if ($containerRunning -eq "true") {
    $procCheck = docker exec "$ContainerName" pgrep -f "n8n" 2>&1
    if ($LASTEXITCODE -eq 0 -and $procCheck) {
        Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "PASS" -Message "N8n process detected (PID: $procCheck)."
    } else {
        Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "WARN" -Message "N8n process not detected - container may still be initializing."
    }
} else {
    # Container not running - check if it was a graceful exit or crash
    $exitCode = docker inspect -f '{{.State.ExitCode}}' "$ContainerName" 2>&1
    if ($exitCode -eq "0") {
        Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "INFO" -Message "Container exited gracefully (exit code 0)."
    } else {
        Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "WARN" -Message "Container not running (exit code: $exitCode)."
    }
}
