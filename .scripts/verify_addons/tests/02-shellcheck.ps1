<#
.SYNOPSIS
    ShellCheck - lints shell scripts for common issues.
#>
param(
    [Parameter(Mandatory)][array]$Addons,
    [Parameter(Mandatory)][hashtable]$Config,
    [bool]$ChangedOnly = $false,
    [hashtable]$ChangedAddons = @{},
    [string]$RepoRoot,
    [bool]$DockerAvailable = $false
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

Write-Header "2. ShellCheck"

# Try to find shellcheck in path or RepoRoot
$shellcheck = "shellcheck"
$useDocker = $false

if (Get-Command "shellcheck" -ErrorAction SilentlyContinue) {
    # Found in path
} elseif ($RepoRoot -and (Test-Path (Join-Path $RepoRoot "shellcheck.exe"))) {
    $shellcheck = Join-Path $RepoRoot "shellcheck.exe"
} else {
    $shellcheck = $null
    if ($Config.dockerTests -contains "ShellCheck" -or $DockerAvailable) {
         # Fallback to Docker
         $useDocker = $true
         # $shellcheck variable is not used for Docker runs, logic is inline below
    }
}

$i = 0
foreach ($a in $Addons) {
    $i++
    Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
    if (-not (Should-RunTest -AddonName $a.Name -TestName "ShellCheck" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

    if (-not $shellcheck -and -not $useDocker) {
        Add-Result -Addon $a.Name -Check "ShellCheck" -Status "SKIP" -Message "Binary missing"
        continue
    }

    $sh = Get-ChildItem $a.FullName -Recurse -Filter "*.sh" | Where-Object { $_.FullName -notmatch '([\\/])node_modules([\\/]|$)' }
    $failed = $false

    foreach ($s in $sh) {
        try {
            if ($useDocker) {
                # Relative path calculation that handles trailing slashes in RepoRoot robustly
                # Ensure RepoRoot does not end with separator for consistent subtraction
                $rootLen = $RepoRoot.TrimEnd('\').TrimEnd('/').Length
                if ($s.FullName.Length -gt $rootLen) {
                     $relPath = $s.FullName.Substring($rootLen).Replace("\", "/").TrimStart("/")
                } else {
                     $relPath = $s.Name # Fallback
                }

                # We need to invoke docker command string. Invoke-Expression is risky but we control the string relative to known command.
                # Safer: Argument splitting
                docker run --rm -v "$($RepoRoot):/mnt" -w /mnt koalaman/shellcheck:stable -s bash -e SC2086 "$relPath"
            } else {
                & $shellcheck -s bash -e SC2086 $s.FullName
            }
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
