param(
    $Addon,
    $Config,
    $OutputDir,
    $RepoRoot,
    $ContainerName
)

Write-Host "    [CustomTest] Verifying Web Interface on port 8080..." -ForegroundColor Gray

# Since we added a HEALTHCHECK to the Dockerfile, the container should be healthy when this runs.
# However, the application might still be starting up.

$maxRetries = 15
$retryDelay = 5
$success = $false
$curlOutput = ""

for ($i = 1; $i -le $maxRetries; $i++) {
    Write-Host "    [CustomTest] Attempt $i / $maxRetries - Checking connectivity..." -ForegroundColor Gray

    # Connectivity Check
    # We use docker exec to run curl inside the container
    $curlOutput = docker exec $ContainerName curl -s -v http://127.0.0.1:8080 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "    [PASS] Web interface responded successfully." -ForegroundColor Green
        $success = $true
        break
    }
    else {
        Write-Host "    [WAIT] Web interface not ready yet (Exit Code $LASTEXITCODE). Retrying in $($retryDelay)s..." -ForegroundColor Yellow
        Start-Sleep -Seconds $retryDelay
    }
}

if (-not $success) {
    Write-Host "    [FAIL] Web interface check failed after $maxRetries attempts." -ForegroundColor Red
    Write-Host "    DEBUG Last Curl Output: $curlOutput" -ForegroundColor Red

    # Try to get container logs for debugging
    Write-Host "    [DEBUG] Container Logs:" -ForegroundColor Gray
    docker logs $ContainerName 2>&1 | Select-Object -Last 50 | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkGray }

    throw "Application is not reachable on port 8080."
}
else {
    # 2. Content Check
    # Check if the output looks like the Flet app or at least HTML
    if ($curlOutput -match "<html" -or $curlOutput -match "SwitchCraft") {
         Write-Host "    [PASS] Expected content detected in response." -ForegroundColor Green
    }
    else {
         Write-Host "    [WARN] Web interface responded, but content verification was inconclusive." -ForegroundColor Yellow
    }
}
