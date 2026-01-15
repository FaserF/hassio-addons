param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [Parameter(Mandatory)]$ContainerName
)
Write-Host "    > [Custom] Verifying Komodo..." -ForegroundColor Gray

$logs = docker logs "$ContainerName" 2>&1

# Check for banner (indicates addon started)
if ($logs -match "FaserF's Addon Repository") {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "PASS" -Message "Banner found."
} else {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "FAIL" -Message "Banner not found in container logs."
}

# Check for Komodo startup messages
# Adjust these strings based on actual Komodo output if known,
# but generic "Komodo" or specific log lines from my run script are good starts.
if ($logs -match "Starting Komodo...") {
    Add-Result -Addon $Addon.Name -Check "StartupCheck" -Status "PASS" -Message "Komodo startup message found."
} else {
    Add-Result -Addon $Addon.Name -Check "StartupCheck" -Status "WARN" -Message "Komodo startup message not found in logs."
}

# Check for MongoDB connection/startup
if ($logs -match "MongoDB is ready.") {
    Add-Result -Addon $Addon.Name -Check "MongoCheck" -Status "PASS" -Message "MongoDB ready message found."
} else {
    Add-Result -Addon $Addon.Name -Check "MongoCheck" -Status "WARN" -Message "MongoDB ready message not found."
}

# Check connectivity to Komodo WebUI (Port 9120)
# Note: In the mock environment, localhost access depends on how the container is run.
# If run with -p 9120:9120, checking localhost:9120 works.
# The verify script typically runs containers on the host network or maps ports.
try {
    # Check identifying string from the web page (e.g. <title>Komodo</title>)
    $response = Invoke-WebRequest -Uri "http://localhost:9120" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
         Add-Result -Addon $Addon.Name -Check "PortCheck" -Status "PASS" -Message "Web UI accessible on port 9120."
    } else {
         Add-Result -Addon $Addon.Name -Check "PortCheck" -Status "WARN" -Message "Web UI returned status code $($response.StatusCode)."
    }
} catch {
    Add-Result -Addon $Addon.Name -Check "PortCheck" -Status "WARN" -Message "Failed to access Web UI on port 9120: $_"
}

# Check if komodo process is running
$containerRunning = docker inspect -f '{{.State.Running}}' "$ContainerName" 2>&1
if ($containerRunning -eq "true") {
    $procCheck = docker exec "$ContainerName" pgrep -f "komodo" 2>&1
    if ($LASTEXITCODE -eq 0 -and $procCheck) {
        Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "PASS" -Message "Komodo process detected (PID: $procCheck)."
    } else {
        Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "WARN" -Message "Komodo process not detected - container may still be initializing."
    }
} else {
    $exitCode = docker inspect -f '{{.State.ExitCode}}' "$ContainerName" 2>&1
    Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "FAIL" -Message "Container not running (exit code: $exitCode)."
}
