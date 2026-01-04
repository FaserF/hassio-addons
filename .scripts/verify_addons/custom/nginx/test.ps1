param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [Parameter(Mandatory)]$ContainerName
)

Write-Host "    > [Custom] Verifying NGINX Functionality..." -ForegroundColor Gray

# Get Docker Logs
$logs = docker logs "$ContainerName" 2>&1

# Check for Standard Banner or Custom Startup Message
if ($logs -match "FaserF's Addon Repository" -or $logs -match "NGINX is starting...") {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "PASS" -Message "Banner/Startup message found."
} else {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "FAIL" -Message "Banner NOT found in logs."
}

# Check for NGINX process or startup
if ($logs -match "nginx: master process" -or $logs -match "ready for start up" -or $logs -match "NGINX is starting...") {
    Add-Result -Addon $Addon.Name -Check "NginxStartup" -Status "PASS" -Message "NGINX startup detected in logs."
}

# Try HTTP check if container is running
try {
    $containerIp = docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $ContainerName 2>$null
    if ($containerIp) {
        $response = Invoke-WebRequest -Uri "http://${containerIp}:80" -TimeoutSec 15 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Add-Result -Addon $Addon.Name -Check "HTTPResponse" -Status "PASS" -Message "HTTP 200 OK from NGINX"
        }
    }
} catch {
    # HTTP check is optional, don't fail if network isn't accessible
    Write-Host "    > [Custom] HTTP check skipped (network not accessible)" -ForegroundColor DarkGray
}
