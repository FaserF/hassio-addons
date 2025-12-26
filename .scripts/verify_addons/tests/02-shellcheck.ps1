<#
.SYNOPSIS
    ShellCheck - lints shell scripts for common issues.
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

Write-Header "2. ShellCheck"

# Try to find shellcheck in path or RepoRoot
$shellcheck = "shellcheck"
if (Get-Command "shellcheck" -ErrorAction SilentlyContinue) {
    # Found in path
} elseif ($RepoRoot -and (Test-Path (Join-Path $RepoRoot "shellcheck.exe"))) {
    $shellcheck = Join-Path $RepoRoot "shellcheck.exe"
} else {
    $shellcheck = $null
}

$i = 0
foreach ($a in $Addons) {
    $i++
    Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
    if (-not (Should-RunTest -AddonName $a.Name -TestName "ShellCheck" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

    if (-not $shellcheck) {
        Add-Result -Addon $a.Name -Check "ShellCheck" -Status "SKIP" -Message "Binary missing"
        continue
    }

    $sh = Get-ChildItem $a.FullName -Recurse -Filter "*.sh"
    $failed = $false

    foreach ($s in $sh) {
        try {
            & $shellcheck -s bash -e SC2086 $s.FullName
            if ($LASTEXITCODE -ne 0) { throw "Fail" }
        }
        catch {
            Add-Result -Addon $a.Name -Check "ShellCheck" -Status "FAIL" -Message "$($s.Name) failed"
            $failed = $true
        }
    }

    if (-not $failed) {
        Add-Result -Addon $a.Name -Check "ShellCheck" -Status "PASS" -Message "OK"
    }
}
