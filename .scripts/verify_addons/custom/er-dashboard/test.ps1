param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [Parameter(Mandatory)]$ContainerName
)
Write-Host "    > [Custom] Verifying ER-Dashboard..." -ForegroundColor Gray

# 1. Check Backend (FastAPI docs)
Write-Host "    Checking Backend (FastAPI)..."
$backendCheck = docker exec "$ContainerName" curl -sSf http://127.0.0.1:13000/docs 2>&1
if ($LASTEXITCODE -eq 0) {
    Add-Result -Addon $Addon.Name -Check "BackendCheck" -Status "PASS" -Message "Backend is responding."
} else {
    Add-Result -Addon $Addon.Name -Check "BackendCheck" -Status "FAIL" -Message "Backend failed to respond."
}

# 2. Check Nginx Ingress (Internal Port 8099)
Write-Host "    Checking Ingress on internal port 8099..."
$ingressCheck = docker exec "$ContainerName" curl -sSf http://127.0.0.1:8099 2>&1
if ($LASTEXITCODE -eq 0) {
    Add-Result -Addon $Addon.Name -Check "IngressCheck" -Status "PASS" -Message "Ingress is responding internally."
} else {
    Add-Result -Addon $Addon.Name -Check "IngressCheck" -Status "FAIL" -Message "Ingress failed to respond."
}

# 3. Check PostgreSQL is running
Write-Host "    Checking PostgreSQL..."
$pgCheck = docker exec "$ContainerName" pg_isready 2>&1
if ($LASTEXITCODE -eq 0) {
    Add-Result -Addon $Addon.Name -Check "PostgreSQLCheck" -Status "PASS" -Message "PostgreSQL is accepting connections."
} else {
    Add-Result -Addon $Addon.Name -Check "PostgreSQLCheck" -Status "WARN" -Message "PostgreSQL not responding (may be normal during startup)."
}
