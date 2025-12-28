param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [Parameter(Mandatory)]$ContainerName
)

. "$PSScriptRoot/../../lib/common.ps1"

Write-Host "    [CustomTest] Verifying PHP extensions..." -ForegroundColor Cyan

# Check for posix extension
# Since DockerRun skips due to 'mysql:need', we must run a transient container.
# The image built by 11-docker-build-run.ps1 is named "local/pterodactyl-panel:test" (standard convention in this suite)
# We verify this manually or just assume it based on common.ps1

$ImageName = "local/test-pterodactyl-panel"

Write-Host "    > Testing image: $ImageName" -ForegroundColor Gray
$execRes = docker run --rm --entrypoint php $ImageName -m 2>&1

if ($LASTEXITCODE -ne 0) {
    Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "FAIL" -Message "Failed to execute php -m inside container: $execRes"
    return
}

if ($execRes -match "posix") {
    Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "PASS" -Message "PHP extension 'posix' found."
}
else {
    Add-Result -Addon $Addon.Name -Check "CustomTests" -Status "FAIL" -Message "PHP extension 'posix' NOT found."
}
