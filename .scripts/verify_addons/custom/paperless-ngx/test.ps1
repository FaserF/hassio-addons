param($Addon, $Config, $OutputDir, $RepoRoot, $ContainerName)

Write-Host "    [Custom] verifying Paperless-ngx specific functionality..." -ForegroundColor Cyan

# 1. Check if the login page is accessible
Write-Host "    [Custom] Checking web interface access (internal curl)..." -ForegroundColor Gray
$httpCode = docker exec $ContainerName curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/

if ($httpCode -eq "200" -or $httpCode -eq "302") {
    Write-Host "    [Custom] ✅ Web interface reachable (HTTP $httpCode)" -ForegroundColor Green
} else {
    Write-Host "    [Custom] ❌ Web interface unreachable (HTTP $httpCode)" -ForegroundColor Red
    Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "FAIL" -Message "Web interface unreachable (HTTP $httpCode)"
    return
}

# 2. Check specific content (e.g. title) to ensure it's not just a generic error page
$content = docker exec $ContainerName curl -s -L http://localhost:8000/admin/login/
if ($content -match "Paperless-ngx" -or $content -match "Django") {
    Write-Host "    [Custom] ✅ Login page content verified" -ForegroundColor Green
    Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "PASS" -Message "Functionality Verified"
} else {
    Write-Host "    [Custom] ❌ Content verification failed. Output sample:" -ForegroundColor Red
    Write-Host ($content | Select-Object -First 5)
    Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "FAIL" -Message "Content verification failed"
}
