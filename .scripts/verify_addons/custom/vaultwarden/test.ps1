param(
    $Addon,
    $Config,
    $OutputDir,
    $RepoRoot,
    $ContainerName
)

Write-Host "    [CustomTest] Verifying Vaultwarden Web Interface on port 7277..." -ForegroundColor Gray

# Connectivity check loop
$maxRetries = 30
$retryDelay = 5
$success = $false
$curlOutput = ""

for ($i = 1; $i -le $maxRetries; $i++) {
    Write-Host "    [CustomTest] Attempt $i / $maxRetries - Checking connectivity..." -ForegroundColor Gray

    # Connectivity Check
    # We use docker exec to run curl inside the container
    $curlOutput = docker exec $ContainerName curl -f -s -v --connect-timeout 2 --max-time 5 http://127.0.0.1:7277 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "    [PASS] Vaultwarden responded successfully." -ForegroundColor Green
        $success = $true
        break
    }
    else {
        Write-Host "    [WAIT] Vaultwarden not ready yet (Exit Code $LASTEXITCODE). Retrying in $($retryDelay)s..." -ForegroundColor Yellow
        Start-Sleep -Seconds $retryDelay
    }
}

if (-not $success) {
    Write-Host "    [FAIL] Vaultwarden check failed after $maxRetries attempts." -ForegroundColor Red
    Write-Host "    DEBUG Last Curl Output: $curlOutput" -ForegroundColor Red

    # Try to get container logs for debugging
    Write-Host "    [DEBUG] Container Logs:" -ForegroundColor Gray
    docker logs $ContainerName 2>&1 | Select-Object -Last 50 | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkGray }

    throw "Vaultwarden is not reachable on port 7277."
}
else {
    # 2. Content Check
    # Vaultwarden often returns a page with "Vaultwarden" or "bitwarden-webapp"
    if ($curlOutput -match "vaultwarden" -or $curlOutput -match "bitwarden") {
         Write-Host "    [PASS] Expected content detected in response." -ForegroundColor Green
    }
    else {
         Write-Host "    [WARN] Web interface responded, but content verification was inconclusive." -ForegroundColor Yellow
    }
}
