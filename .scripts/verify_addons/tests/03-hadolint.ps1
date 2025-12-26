<#
.SYNOPSIS
    Hadolint - lints Dockerfiles via Docker.
#>
param(
    [Parameter(Mandatory)][array]$Addons,
    [Parameter(Mandatory)][hashtable]$Config,
    [bool]$DockerAvailable = $false,
    [bool]$ChangedOnly = $false,
    [hashtable]$ChangedAddons = @{},
    [string]$RepoRoot
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

Write-Header "3. Hadolint"

if ($DockerAvailable) {
    $i = 0
    foreach ($a in $Addons) {
        $i++
        Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
        if (-not (Should-RunTest -AddonName $a.Name -TestName "Hadolint" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

        $df = Join-Path $a.FullName "Dockerfile"
        if (Test-Path $df) {
            try {
                $out = (Get-Content $df | docker run --rm -i hadolint/hadolint hadolint - 2>&1)
                if ($LASTEXITCODE -ne 0) {
                    Add-Result -Addon $a.Name -Check "Hadolint" -Status "FAIL" -Message $out
                }
                else {
                    Add-Result -Addon $a.Name -Check "Hadolint" -Status "PASS" -Message "OK"
                }
            }
            catch {
                Add-Result -Addon $a.Name -Check "Hadolint" -Status "SKIP" -Message "Docker unavailable"
            }
        }
    }
}
else {
    Add-Result -Addon "Global" -Check "Hadolint" -Status "WARN" -Message "Docker unavailable"
}
