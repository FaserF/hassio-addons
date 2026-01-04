param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [Parameter(Mandatory)]$ContainerName
)
Write-Host "    > [Custom] Verifying Matterbridge..." -ForegroundColor Gray
$logs = docker logs "$ContainerName" 2>&1
if ($logs -match "FaserF's Addon Repository") {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "PASS" -Message "Banner found."
}
if ($logs -match "Running matterbridge") {
     Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "PASS" -Message "Matterbridge start detected."
} else {
     Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "WARN" -Message "Start message not found (check logs)."
}
