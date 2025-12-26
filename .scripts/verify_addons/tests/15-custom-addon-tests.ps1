<#
.SYNOPSIS
    Custom Addon Tests - runs addon-specific tests defined in a 'custom' directory.
.DESCRIPTION
    This script looks for test.ps1 in .scripts/verify_addons/custom/<slug>/ and executes it.
    It supports container reuse from the DockerRun stage.
#>
param(
    [Parameter(Mandatory)][array]$Addons,
    [Parameter(Mandatory)][hashtable]$Config,
    [Parameter(Mandatory)][string]$OutputDir,
    [Parameter(Mandatory)][string]$RepoRoot,
    [bool]$DockerAvailable = $false,
    [bool]$ChangedOnly = $false,
    [hashtable]$ChangedAddons = @{}
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

Write-Header "15. Custom Addon Tests"

$customBaseDir = Join-Path $PSScriptRoot "../custom"
if (-not (Test-Path $customBaseDir)) {
    New-Item -ItemType Directory -Path $customBaseDir -Force | Out-Null
}

function Cleanup-Test-Container {
    param($AddonName, $OutputDir, $DockerAvailable)
    $contName = "test-run-$($AddonName.ToLower())"

    if ($DockerAvailable -and (docker ps -a -q -f "name=^$contName$")) {
        Write-Host "    > [Cleanup] Removing container '$contName'..." -ForegroundColor Gray
        docker rm -f "$contName" 2>&1 | Out-Null
    }

    $safeName = $AddonName -replace '[^a-zA-Z0-9_\-]', '_'
    $tempDir = Join-Path $OutputDir "tmp_test_runs/ha-addon-test-$safeName"
    if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force 2>$null }
}

try {
    $i = 0
    foreach ($a in $Addons) {
        $i++
        if (-not (Should-RunTest -AddonName $a.Name -TestName "CustomTests" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

        $addonCustomDir = Join-Path $customBaseDir $a.Name
        $testScript = Join-Path $addonCustomDir "test.ps1"
        $contName = "test-run-$($a.Name.ToLower())"

        if (Test-Path $testScript) {
            Write-Host "    > Running custom test for $($a.Name)..." -ForegroundColor Gray

            # Check if DockerRun failed for this addon
            $dockerRunResult = $global:Results | Where-Object { $_.Addon -eq $a.Name -and $_.Check -eq "DockerRun" }

            if (-not $dockerRunResult) {
                Add-Result -Addon $a.Name -Check "CustomTests" -Status "SKIP" -Message "Skipped because DockerRun was not executed or returned no result."
                continue
            }

            if ($dockerRunResult.Status -eq "FAIL") {
                Add-Result -Addon $a.Name -Check "CustomTests" -Status "SKIP" -Message "Skipped because previous Docker Test failed."
                continue
            }

            # Execute the custom test script
            # We pass relevant variables to the script
            try {
                & $testScript -Addon $a -Config $Config -OutputDir $OutputDir -RepoRoot $RepoRoot -ContainerName $contName
            }
            catch {
                Add-Result -Addon $a.Name -Check "CustomTests" -Status "FAIL" -Message "Custom script crashed: $_"
            }
        }
        else {
            Add-Result -Addon $a.Name -Check "CustomTests" -Status "SKIP" -Message "No custom addon test found (this is common and uncritical)"
        }

        # FINAL CLEANUP via Helper
        Cleanup-Test-Container -AddonName $a.Name -OutputDir $OutputDir -DockerAvailable $DockerAvailable
    }
}
finally {
    # Ensure no containers are left hanging in case of a crash in the loop
    if ($Addons) {
        try {
            foreach ($a in $Addons) {
                 Cleanup-Test-Container -AddonName $a.Name -OutputDir $OutputDir -DockerAvailable $DockerAvailable
            }
        } catch {
            Write-Warning "Cleanup failed: $_"
        }
    }
}
