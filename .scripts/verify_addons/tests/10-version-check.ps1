<#
.SYNOPSIS
    Version Check - validates base images are up to date.
#>
param(
    [Parameter(Mandatory)][array]$Addons,
    [Parameter(Mandatory)][hashtable]$Config,
    [bool]$ChangedOnly = $false,
    [hashtable]$ChangedAddons = @{},
    [string]$RepoRoot
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

Write-Header "10. Base Image & Version Check"

$LatestBase = $Config.latestBase
$LatestDebian = $Config.latestDebian
$LatestPython = $Config.latestPython
$LatestNode = $Config.latestNode

$i = 0
foreach ($a in $Addons) {
    $i++
    Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
    if (-not (Should-RunTest -AddonName $a.Name -TestName "VersionCheck" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

    $buildFile = Join-Path $a.FullName "build.yaml"
    if (Test-Path $buildFile) {
        $base = Get-BuildFrom $buildFile
        $baseImage = $base

        if ($baseImage) {
            # Check against known latest versions
            if ($baseImage -match "ghcr\.io/hassio-addons/base:([\w\.-]+)") {
                $ver = $matches[1]
                if ($ver -ne $LatestBase) {
                    Add-Result -Addon $a.Name -Check "Ver-Base" -Status "WARN" -Message "Uses Base $ver (Latest: $LatestBase)"
                }
                else {
                    Add-Result -Addon $a.Name -Check "Ver-Base" -Status "PASS" -Message "OK ($ver)"
                }
            }
            elseif ($baseImage -match "ghcr\.io/hassio-addons/debian-base:([\w\.-]+)") {
                $ver = $matches[1]
                if ($ver -ne $LatestDebian) {
                    Add-Result -Addon $a.Name -Check "Ver-Debian" -Status "WARN" -Message "Uses Debian $ver (Latest: $LatestDebian)"
                }
                else {
                    Add-Result -Addon $a.Name -Check "Ver-Debian" -Status "PASS" -Message "OK ($ver)"
                }
            }
            elseif ($baseImage -match "ghcr\.io/home-assistant/amd64-base-python:([\w\.-]+)") {
                $ver = $matches[1]
                if ($ver -ne $LatestPython) {
                    Add-Result -Addon $a.Name -Check "Ver-Python" -Status "WARN" -Message "Uses Python $ver (Latest: $LatestPython)"
                }
                else {
                    Add-Result -Addon $a.Name -Check "Ver-Python" -Status "PASS" -Message "OK ($ver)"
                }
            }
            elseif ($baseImage -match "ghcr\.io/hassio-addons/.*python-base.*" -or $baseImage -match "ghcr\.io/hassio-addons/.*base-python.*") {
                Add-Result -Addon $a.Name -Check "Ver-Python" -Status "PASS" -Message "OK (Official Hassio Python Base)"
            }
            else {
                Add-Result -Addon $a.Name -Check "Ver-Base" -Status "INFO" -Message "Unmonitored Base: $baseImage"
            }
        }
    }

    # Check Node Version
    $df = Join-Path $a.FullName "Dockerfile"
    if (Test-Path $df) {
        $content = Get-Content $df -Raw
        if ($content -match 'ARG NODE_VERSION=["'']?([\d\.]+)["'']?') {
            $ver = $matches[1]
            if ($ver -ne $LatestNode) {
                Add-Result -Addon $a.Name -Check "Ver-Node" -Status "WARN" -Message "Uses Node $ver (Latest: $LatestNode)"
            }
            else {
                Add-Result -Addon $a.Name -Check "Ver-Node" -Status "PASS" -Message "OK ($ver)"
            }
        }
    }
}
