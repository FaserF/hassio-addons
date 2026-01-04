param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [Parameter(Mandatory)]$ContainerName
)
Write-Host "    > [Custom] Verifying Apache2-MariaDB..." -ForegroundColor Gray
$logs = docker logs "$ContainerName" 2>&1
if ($logs -match "FaserF's Addon Repository") {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "PASS" -Message "Banner found."
}
$procCheck = docker exec "$ContainerName" ps aux 2>&1
if ($procCheck -match "httpd" -or $procCheck -match "apache2") {
     Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "PASS" -Message "Apache process detected."
} else {
     Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "FAIL" -Message "Apache process NOT found."
}
if ($procCheck -match "mariadbd" -or $procCheck -match "mysqld") {
     Add-Result -Addon $Addon.Name -Check "DBCheck" -Status "PASS" -Message "MariaDB process detected."
} else {
     Add-Result -Addon $Addon.Name -Check "DBCheck" -Status "FAIL" -Message "MariaDB process NOT found."
}
