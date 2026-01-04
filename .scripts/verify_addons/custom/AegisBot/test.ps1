param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [Parameter(Mandatory)]$ContainerName
)
Write-Host "    > [Custom] Verifying AegisBot..." -ForegroundColor Gray
$logs = docker logs "$ContainerName" 2>&1
if ($logs -match "FaserF's Addon Repository") {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "PASS" -Message "Banner found."
} else {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "FAIL" -Message "Banner NOT found."
}
$procCheck = docker exec "$ContainerName" ps aux 2>&1
if ($procCheck -match "node" -or $logs -match "Discord Bot Started") {
     Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "PASS" -Message "Node process/Start log found."
} else {
     Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "WARN" -Message "Bot process not immediately confirmed (check config)."
}
