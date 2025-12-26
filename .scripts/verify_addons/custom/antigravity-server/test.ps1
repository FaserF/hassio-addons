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

# 2. Test: Check for Critical Processes
Write-Host "      - Verifying internal processes (Xvnc, NoVNC, XFCE4)..." -ForegroundColor Gray
$processes = docker exec $ContainerName ps aux

$criticalProcesses = @("Xvnc", "novnc_server", "xfce4-session")
$missingProcesses = @()

foreach ($proc in $criticalProcesses) {
    if ($processes -notmatch $proc) {
        $missingProcesses += $proc
    }
}

if ($missingProcesses.Count -eq 0) {
    Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "PASS" -Message "All critical processes (Xvnc, NoVNC, XFCE4) are running."
} else {
    Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "FAIL" -Message "Missing processes: $($missingProcesses -join ', ')"
}

# 3. Test: Password Persistence
Write-Host "      - Verifying password persistence..." -ForegroundColor Gray
$passwordFileContent = docker exec $ContainerName cat /data/vnc_password

if ($null -ne $passwordFileContent -and $passwordFileContent.Length -ge 8) {
     Add-Result -Addon $Addon.Name -Check "PasswordPersistence" -Status "PASS" -Message "Persistent password file exists and has content."
} else {
     Add-Result -Addon $Addon.Name -Check "PasswordPersistence" -Status "FAIL" -Message "Persistent password file /data/vnc_password missing or empty."
}

# 4. Test: Log Scan for Known Errors
Write-Host "      - Scanning logs for critical errors..." -ForegroundColor Gray
$logs = docker logs $ContainerName 2>&1 | Out-String

if ($logs -match "Unable to load a failsafe session") {
    Add-Result -Addon $Addon.Name -Check "LogHealth" -Status "FAIL" -Message "Found 'Unable to load a failsafe session' error in logs."
} else {
    Add-Result -Addon $Addon.Name -Check "LogHealth" -Status "PASS" -Message "No critical session errors found in logs."
}

# 5. Connectivity Check (Internal Curl)
Write-Host "      - Verifying NoVNC connectivity..." -ForegroundColor Gray
$curlOutput = docker exec $ContainerName curl -I http://127.0.0.1:6080/
if ($curlOutput -match "HTTP/1.1 200 OK" -or $curlOutput -match "HTTP/1.0 200 OK") {
     Add-Result -Addon $Addon.Name -Check "Connectivity" -Status "PASS" -Message "NoVNC service is responding on port 6080."
} else {
     Add-Result -Addon $Addon.Name -Check "Connectivity" -Status "FAIL" -Message "Failed to verify NoVNC on port 6080."
}
