<#
.SYNOPSIS
    Compliance - runs Python compliance checks.
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

Write-Header "8. Compliance"

$i = 0
foreach ($a in $Addons) {
    $i++
    Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
    if (-not (Should-RunTest -AddonName $a.Name -TestName "Compliance" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

    try {
        $scriptPath = Join-Path $RepoRoot ".scripts/check_compliance.py"
        if (-not (Test-Path $scriptPath)) {
            Add-Result -Addon $a.Name -Check "Compliance" -Status "SKIP" -Message "Script missing"
        }
        else {
            $out = python $scriptPath $a.FullName 2>&1
            if ($LASTEXITCODE -eq 0) {
                Add-Result -Addon $a.Name -Check "Compliance" -Status "PASS" -Message "OK"
            }
            else {
                Add-Result -Addon $a.Name -Check "Compliance" -Status "FAIL" -Message "See details below"
                Write-Host "`n--- COMPLIANCE REPORT FOR $($a.Name) ---" -ForegroundColor Red
                if ($out -is [array]) { $out = $out -join "`n" }
                Write-Host $out -ForegroundColor Gray
                Write-Host "----------------------------------------`n" -ForegroundColor Red
            }
        }
    }
    catch {
        Add-Result -Addon $a.Name -Check "Compliance" -Status "SKIP" -Message "Script unavailable"
    }
}
