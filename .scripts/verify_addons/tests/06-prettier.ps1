<#
.SYNOPSIS
    Prettier - checks code formatting.
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

Write-Header "6. Prettier"

$i = 0
foreach ($a in $Addons) {
    $i++
    Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
    if (-not (Should-RunTest -AddonName $a.Name -TestName "Prettier" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

    try {
        $ptarget = "$($a.FullName)\**\*.{json,js,md,yaml}"
        $ignorePath = Join-Path $RepoRoot ".prettierignore"
        npx prettier --check $ptarget --ignore-path "$ignorePath"
        if ($LASTEXITCODE -ne 0) { throw "Fail" }
        Add-Result -Addon $a.Name -Check "Prettier" -Status "PASS" -Message "OK"
    }
    catch {
        Add-Result -Addon $a.Name -Check "Prettier" -Status "FAIL" -Message "Formatting issues"
    }
}
