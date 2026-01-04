param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [Parameter(Mandatory)]$ContainerName
)

Write-Host "    > [Custom] Verifying Netboot.xyz Functionality..." -ForegroundColor Gray

# Get Docker Logs
$logs = docker logs "$ContainerName" 2>&1

# 1. Check for Standard Banner
if ($logs -match "FaserF's Addon Repository") {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "PASS" -Message "Standard banner found."
} else {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "FAIL" -Message "Standard banner NOT found in logs."
}

# 2. Check for Permission Fixes (Key fix we implemented)
$permCheck = docker exec "$ContainerName" ls -ld /config 2>&1
if ($permCheck -match "abc") {
    Add-Result -Addon $Addon.Name -Check "PermCheck" -Status "PASS" -Message "/config permissions set to abc."
} else {
    Add-Result -Addon $Addon.Name -Check "PermCheck" -Status "FAIL" -Message "/config permissions NOT found to be abc: $permCheck"
}

# 3. Check for Symlink Logic (Key fix we implemented)
# We expect /config to be a symlink or directory depending on the test setup.
# In the test container, /config is likely a volume or directory, but we can check if our script logic ran.
# We'll check if the startup script ran without errors.

if ($logs -match "Removing existing /config directory to replace with symlink") {
    Add-Result -Addon $Addon.Name -Check "SymlinkLogic" -Status "PASS" -Message "Symlink replacement logic logged."
} elseif ($logs -match "Info: /config is a mount") {
    Add-Result -Addon $Addon.Name -Check "SymlinkLogic" -Status "PASS" -Message "Mount detection logic logged."
} else {
    # It might not log if the condition (directory exists and not mount) isn't met, or if it was fresh.
    # But since we fixed the logic, checking for ANY 10-prerequisite.sh errors is good.
    if ($logs -match "mkdir: can't create directory '/config': File exists") {
        Add-Result -Addon $Addon.Name -Check "SymlinkLogic" -Status "FAIL" -Message "Failed to create /config (old error pattern)."
    } else {
         Add-Result -Addon $Addon.Name -Check "SymlinkLogic" -Status "INFO" -Message "No symlink replacement logs found (expected on fresh volume)."
    }
}

# 4. Check Nginx Process
$procCheck = docker exec "$ContainerName" ps aux 2>&1
if ($procCheck -match "nginx: master process") {
     Add-Result -Addon $Addon.Name -Check "NginxProcess" -Status "PASS" -Message "Nginx is running."
} else {
     Add-Result -Addon $Addon.Name -Check "NginxProcess" -Status "FAIL" -Message "Nginx process NOT found."
     Write-Host "    ! LOGS START (Last 100 lines) !" -ForegroundColor Yellow
     $logs | Select-Object -Last 100 | Write-Host
     Write-Host "    ! LOGS END !" -ForegroundColor Yellow
}

# 5. Check Node Process (WebApp)
if ($procCheck -match "node app.js") {
     Add-Result -Addon $Addon.Name -Check "NodeProcess" -Status "PASS" -Message "Node.js WebApp is running."
} else {
     Add-Result -Addon $Addon.Name -Check "NodeProcess" -Status "FAIL" -Message "Node.js WebApp process NOT found."
}

# 6. HTTP Check (Port 3000)
try {
    $containerIp = docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $ContainerName 2>$null
    if ($containerIp) {
        # Retry loop for HTTP check as node startup might take a few seconds
        $httpSuccess = $false
        for ($i=0; $i -lt 5; $i++) {
            try {
                $response = Invoke-WebRequest -Uri "http://${containerIp}:3000" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
                if ($response.StatusCode -eq 200) {
                    $httpSuccess = $true
                    break
                }
            } catch {
                Start-Sleep -Seconds 2
            }
        }

        if ($httpSuccess) {
            Add-Result -Addon $Addon.Name -Check "HTTPResponse" -Status "PASS" -Message "HTTP 200 OK from WebApp (Port 3000)"
        } else {
             Add-Result -Addon $Addon.Name -Check "HTTPResponse" -Status "FAIL" -Message "HTTP Check on Port 3000 failed."
        }
    }
} catch {
    Write-Host "    > [Custom] HTTP check skipped (network not accessible)" -ForegroundColor DarkGray
}
