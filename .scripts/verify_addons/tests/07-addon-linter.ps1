<#
.SYNOPSIS
    Add-on Linter - runs the official HA addon linter via Docker.
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

Write-Header "7. Add-on Linter"

if ($DockerAvailable) {
    $img = "addon-linter:local"

    if (-not (docker images -q $img)) {
        Write-Host "Building addon-linter from source (frenck/action-addon-linter)..." -ForegroundColor Gray
        try {
            docker build -t $img "https://github.com/frenck/action-addon-linter.git#:src" 2>&1 | Out-Null
        } catch {
            Write-Warning "Docker build failed: $_"
        }
    }

    if (-not (docker images -q $img)) {
        Add-Result -Addon "Global" -Check "AddonLinter" -Status "SKIP" -Message "Image build failed, skipping."
    }
    else {
        $i = 0
        foreach ($a in $Addons) {
            $i++
            Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
            if (-not (Should-RunTest -AddonName $a.Name -TestName "AddonLinter" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

            try {
                # GitHub Actions use INPUT_* env vars, not CLI args
                $res = docker run --rm -v "$($a.FullName):/data" -e INPUT_PATH=/data -e INPUT_COMMUNITY=false $img 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Add-Result -Addon $a.Name -Check "AddonLinter" -Status "PASS" -Message "OK"
                }
                elseif ($a.Name -eq "netboot-xyz" -and $res -match "full_access") {
                    # netboot-xyz requires full access for network boot services
                    Add-Result -Addon $a.Name -Check "AddonLinter" -Status "WARN" -Message "Allowed 'full_access' (User Required)"
                }
                else {
                    Add-Result -Addon $a.Name -Check "AddonLinter" -Status "FAIL" -Message $res
                }
            }
            catch {
                Add-Result -Addon $a.Name -Check "AddonLinter" -Status "FAIL" -Message "Docker run failed: $($_.Exception.Message)"
            }
        }
    }
}
