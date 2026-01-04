<#
.SYNOPSIS
    Line ending check - detects and optionally fixes CRLF line endings.
#>
param(
    [Parameter(Mandatory)][array]$Addons,
    [Parameter(Mandatory)][hashtable]$Config,
    [bool]$Fix = $false,
    [bool]$ChangedOnly = $false,
    [hashtable]$ChangedAddons = @{},
    [string]$RepoRoot
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

Write-Header "1. Line Ending Check"

$i = 0
foreach ($a in $Addons) {
    $i++
    Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
    if (-not (Should-RunTest -AddonName $a.Name -TestName "LineEndings" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

    $files = Get-ChildItem $a.FullName -Recurse -Include "*.sh", "*.md", "*.yaml"
    $crlfFound = $false

    foreach ($f in $files) {
        $content = [IO.File]::ReadAllText($f.FullName)
        if ($content.Contains("`r`n")) {
            $crlfFound = $true
            if ($Fix) {
                $content = $content -replace "`r`n", "`n"
                [IO.File]::WriteAllText($f.FullName, $content)
                Add-Result -Addon $a.Name -Check "LineEndings" -Status "PASS" -Message "Fixed $($f.Name)"
                $crlfFound = $false
            }
            else {
                Add-Result -Addon $a.Name -Check "LineEndings" -Status "FAIL" -Message "CRLF in $($f.Name)"
                break
            }
        }
    }

    if (-not $crlfFound) {
        Add-Result -Addon $a.Name -Check "LineEndings" -Status "PASS" -Message "OK"
    }
}
