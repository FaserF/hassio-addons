<#
.SYNOPSIS
    CodeRabbit-Style Deep Checks - static analysis for Dockerfiles.
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

Write-Header "12. CodeRabbit-Style Deep Checks"

$i = 0
foreach ($a in $Addons) {
    $i++
    Write-Progress -Id 1 -Activity "Checking Add-ons" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
    if (-not (Should-RunTest -AddonName $a.Name -TestName "CodeRabbit" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

    $df = Join-Path $a.FullName "Dockerfile"
    $buildFile = Join-Path $a.FullName "build.yaml"

    if (Test-Path $df) {
        $content = Get-Content $df -Raw

        # Check 1: Unpinned Git Clone
        if ($content -match 'git clone(?!.*--branch)(?!.*--single-branch).*https://') {
            if ($content -notmatch 'git checkout [a-f0-9]{40}') {
                Add-Result -Addon $a.Name -Check "CR-UnpinnedGit" -Status "WARN" -Message "Unpinned git clone detected. Pin to specific SHA/tag for reproducible builds."
            }
        }

        # Check 2: Generic Healthcheck Patterns
        if ($content -match 'HEALTHCHECK.*pgrep.*-f.*"\.\*"') {
            Add-Result -Addon $a.Name -Check "CR-GenericHealth" -Status "WARN" -Message "Generic HEALTHCHECK pattern (e.g., 'node.*server'). Use specific process name."
        }

        # Check 3: Manual Tarball without integrity
        if ($content -match '(wget|curl).*\.(tar|tgz|tar\.gz)' -and $content -notmatch 'sha256|checksum|--checksum') {
            Add-Result -Addon $a.Name -Check "CR-TarballIntegrity" -Status "WARN" -Message "Manual tarball download without integrity check. Consider using official image or add checksum verification."
        }

        # Check 4: Duplicate ARG declarations
        $argMatches = [regex]::Matches($content, '(?m)^ARG\s+([A-Z_]+)')
        $argNames = $argMatches | ForEach-Object { $_.Groups[1].Value }
        $duplicates = $argNames | Group-Object | Where-Object { $_.Count -gt 1 }
        if ($duplicates) {
            $dupList = ($duplicates | ForEach-Object { $_.Name }) -join ", "
            Add-Result -Addon $a.Name -Check "CR-DuplicateARG" -Status "WARN" -Message "Duplicate ARG declarations: $dupList"
        }

        # Check 5: Using :latest tag in FROM
        if ($content -match 'FROM\s+\S+:latest') {
            Add-Result -Addon $a.Name -Check "CR-LatestTag" -Status "WARN" -Message "Using :latest tag in FROM. Pin to specific version for reproducible builds."
        }

        # Check 7: Unpinned package versions in apk add
        if ($content -match 'apk add' -and $content -notmatch '(?m)apk add(.*\s+[\w\-._]+[=~][\d.]+)') {
            $cleanContent = $content -replace '--no-cache', ''
            if ($cleanContent -match 'apk add\s+((?![\w\-._]+[=~])[\w\-._]+\s*)+') {
                Add-Result -Addon $a.Name -Check "CR-UnpinnedPackage" -Status "WARN" -Message "Unpinned package versions in 'apk add' detected. Pin versions for reproducibility."
            }
        }

        # Check 8: Missing HEALTHCHECK timing parameters
        if ($content -match 'HEALTHCHECK' -and ($content -notmatch '--interval' -or $content -notmatch '--timeout')) {
            Add-Result -Addon $a.Name -Check "CR-HealthcheckTiming" -Status "WARN" -Message "HEALTHCHECK lacks explicit --interval or --timeout parameters."
        }

        # Check 9: Fragile healthcheck pattern
        if ($content -match 'pgrep -f run\.sh') {
            Add-Result -Addon $a.Name -Check "CR-FragileHealth" -Status "WARN" -Message "Healthcheck uses 'pgrep -f run.sh' which is fragile. Consider a more specific binary or functional check."
        }

        # Check 10: Missing --no-cache-dir in pip install
        if ($content -match 'pip install' -and $content -notmatch '--no-cache-dir') {
            Add-Result -Addon $a.Name -Check "CR-PipNoCache" -Status "WARN" -Message "pip install lacks --no-cache-dir flag. This increases image size."
        }

        # Check 11: Empty or missing BUILD_DATE default
        if ($content -match 'ARG BUILD_DATE' -and ($content -notmatch 'ARG BUILD_DATE=.' -or $content -match 'ARG BUILD_DATE=""')) {
            Add-Result -Addon $a.Name -Check "CR-BuildDateDefault" -Status "WARN" -Message "ARG BUILD_DATE has empty or missing default. Use '1970-01-01T00:00:00Z' for local builds."
        }

        # Check 12: Non-standard Hadolint ignores
        if ($content -match 'hadolint ignore=([\w,]+)') {
            $ignores = $matches[1].Split(',')
            foreach($ig in $ignores) {
                if ($ig -eq "DL3047") {
                    Add-Result -Addon $a.Name -Check "CR-NonStandardHadolint" -Status "WARN" -Message "Non-standard Hadolint ignore DL3047 detected (might be a typo)."
                }
            }
        }

        # Check 13: Python Base Image enforcement
        if ($content -match 'pip install|python3?\s+.*\.py') {
            if ($content -notmatch 'CR-Skip-PythonBaseCheck' -and $content -notmatch 'FROM\s+(ghcr\.io/hassio-addons/(python-base|base)|ghcr\.io/home-assistant/.*-base-python)') {
                Add-Result -Addon $a.Name -Check "CR-PythonBase" -Status "FAIL" -Message "Addon uses Python but not the official python-base image. Use 'ghcr.io/hassio-addons/python-base' or add '# CR-Skip-PythonBaseCheck' to exclusion."
            }
        }

        # Check 14: Language Check (English only)
        if ($content -match '[üäößÜÄÖ]' -or $content -cmatch '\b(ist|und|das|mit|der|die|den|dem|ein|eine|eines|einer)\b') {
            Add-Result -Addon $a.Name -Check "CR-Language" -Status "WARN" -Message "Possible non-English content (German) detected in comments or logs. Keep everything in English."
        }
    }

    # Check 6: Moving tags in build.yaml
    if (Test-Path $buildFile) {
        $buildContent = Get-Content $buildFile -Raw

        if ($buildContent -match ':\s*(beta|latest|dev|edge|nightly)\s*["''$]?') {
            $tag = $matches[1]
            if ($a.Name -eq "homeassistant-test-instance") {
                Add-Result -Addon $a.Name -Check "CR-MovingTag" -Status "INFO" -Message "Using :$tag tag (acceptable for test addon, but consider documenting)"
            } else {
                Add-Result -Addon $a.Name -Check "CR-MovingTag" -Status "WARN" -Message "Using :$tag tag in build.yaml. Pin to specific version for reproducible builds."
            }
        }
    }
}
