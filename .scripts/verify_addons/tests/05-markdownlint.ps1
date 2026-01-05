<#
.SYNOPSIS
    MarkdownLint - lints Markdown files.
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

Write-Header "5. MarkdownLint"

$i = 0
foreach ($a in $Addons) {
    $i++
    Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
    if (-not (Should-RunTest -AddonName $a.Name -TestName "MarkdownLint" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

    try {
        # IMPORTANT: MarkdownLint/glob requires forward slashes even on Windows
        $target = "$($a.FullName)\**\*.md".Replace('\', '/')
        $configPath = Join-Path $RepoRoot ".markdownlint.yaml"

        # Only run if files exist to avoid error
        if (Get-ChildItem -Path $a.FullName -Recurse -Filter "*.md") {
            $output = npx markdownlint-cli $target --config "$configPath" --ignore "node_modules" --ignore ".git" --ignore ".unsupported" 2>&1 | Out-String
            if ($LASTEXITCODE -ne 0) { throw $output }
            Add-Result -Addon $a.Name -Check "MarkdownLint" -Status "PASS" -Message "OK"
        }
    }
    catch {
        $msg = $_.Exception.Message
        # Clean up message to be a single line summary or short snippet
        $summary = $msg.Split([Environment]::NewLine) | Select-Object -First 1
        Add-Result -Addon $a.Name -Check "MarkdownLint" -Status "FAIL" -Message "Errors found: $summary (See log for details)"
        if ($global:VerboseNotifications -or $global:Debug) { Write-Host $msg -ForegroundColor DarkGray }
    }
}
