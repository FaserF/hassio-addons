<#
.SYNOPSIS
    YamlLint - lints YAML files.
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

Write-Header "4. YamlLint"

$i = 0
$i = 0
foreach ($a in $Addons) {
    $i++
    Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
    if (-not (Should-RunTest -AddonName $a.Name -TestName "YamlLint" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

    try {
        $configFile = Join-Path $RepoRoot ".yamllint"
        $argsList = @("-m", "yamllint")
        if (Test-Path $configFile) {
            $argsList += "-c", "$configFile"
        }
        $argsList += "$($a.FullName)"

        $out = python @argsList 2>&1
        if ($LASTEXITCODE -ne 0) {
            Add-Result -Addon $a.Name -Check "YamlLint" -Status "FAIL" -Message "Errors found (See log/output)"
            if ($out -is [array]) { $out = $out -join "`n" }
            Write-Host $out -ForegroundColor Gray
        }
        else {
            Add-Result -Addon $a.Name -Check "YamlLint" -Status "PASS" -Message "OK"
        }
    }
    catch {
        Add-Result -Addon $a.Name -Check "YamlLint" -Status "SKIP" -Message "Tool unavailable"
    }
}
