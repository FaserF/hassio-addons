<#
.SYNOPSIS
    Trivy - security scanning via Docker.
#>
param(
    [Parameter(Mandatory)][array]$Addons,
    [Parameter(Mandatory)][hashtable]$Config,
    [Parameter(Mandatory)][string]$RepoRoot,
    [bool]$DockerAvailable = $false,
    [bool]$ChangedOnly = $false,
    [hashtable]$ChangedAddons = @{}
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

Write-Header "9. Trivy"

if ($DockerAvailable) {
    $trivy = "aquasec/trivy:latest"
    docker volume create trivy_cache >$null

    $pullOutput = docker pull $trivy 2>&1
    $pullFailed = ($LASTEXITCODE -ne 0) -or ($pullOutput -match "denied")
    if ($pullFailed) {
        Add-Result -Addon "Global" -Check "Trivy" -Status "WARN" -Message "Skipping Trivy due to pull failure: $pullOutput"
    }
    else {
        $i = 0
        foreach ($a in $Addons) {
            $i++
            Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
            if (-not (Should-RunTest -AddonName $a.Name -TestName "Trivy" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

            $relPath = $a.FullName.Substring("$RepoRoot".Length).TrimStart('\', '/').Replace('\', '/')
            $res = docker run --rm -v "trivy_cache:/root/.cache/trivy" -v "$($RepoRoot):/app" $trivy fs "/app/$relPath" --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 2>&1

            if ($LASTEXITCODE -ne 0) {
                Add-Result -Addon $a.Name -Check "Trivy" -Status "WARN" -Message "Vulnerabilities Found (See log)"
            }
            else {
                Add-Result -Addon $a.Name -Check "Trivy" -Status "PASS" -Message "OK"
            }
        }
    }
}
