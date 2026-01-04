param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [Parameter(Mandatory)]$ContainerName
)
Write-Host "    > [Custom] Verifying Wordpress..." -ForegroundColor Gray
$logs = docker logs "$ContainerName" 2>&1
if ($logs -match "FaserF's Addon Repository") {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "PASS" -Message "Banner found."
}
$procCheck = docker exec "$ContainerName" ps aux 2>&1
if ($procCheck -match "nginx") {
     Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "PASS" -Message "Nginx process detected."
} else {
     Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "FAIL" -Message "Nginx process NOT found."
}
