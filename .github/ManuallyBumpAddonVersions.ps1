<#
.SYNOPSIS
    A PowerShell script to automatically increment or decrement the version of Home Assistant addons and update their changelogs.

.DESCRIPTION
    This script scans for addon directories that use a base image from "ghcr.io/hassio-addons".
    For each found addon, it increments the patch version in the 'config.yaml' file and adds a new version entry to the 'CHANGELOG.md'.
    Using the -Revert switch, it will perform the opposite: decrement the version and remove the latest changelog entry.

.PARAMETER Revert
    If specified, the script will decrement the version and remove the latest changelog entry.
#>
param(
    [switch]$Revert
)

if ($Revert) {
    Write-Host "Running in REVERT mode." -ForegroundColor Yellow
}
else {
    Write-Host "Running in INCREMENT mode." -ForegroundColor Green
}
Write-Host ""

# --- Get latest addon-base version from GitHub API (only needed for increment) ---
$latestBaseVersion = ""
if (-not $Revert) {
    try {
        $uri = "https://api.github.com/repos/hassio-addons/addon-base/releases/latest"
        $response = Invoke-RestMethod -Uri $uri -Method Get -Headers @{ "Accept" = "application/vnd.github.v3+json" }
        if ($response -and $response.tag_name) {
            $latestBaseVersion = $response.tag_name
            Write-Host "Successfully fetched latest addon-base version: $latestBaseVersion" -ForegroundColor Green
        }
        else {
            Write-Warning "Could not determine latest addon-base version from GitHub API. Defaulting to 'vXXXX'."
            $latestBaseVersion = "vXXXX"
        }
    }
    catch {
        Write-Warning "Failed to fetch latest addon-base version from GitHub API: $_. Defaulting to 'vXXXX'."
        $latestBaseVersion = "vXXXX"
    }
    Write-Host ""
}


# Get the script's directory to resolve relative paths
$scriptPath = $PSScriptRoot

# Find all build.yaml files in the repository, starting from the parent directory of the script's location
$buildFiles = Get-ChildItem -Path (Resolve-Path (Join-Path $scriptPath "..")) -Recurse -Filter "build.yaml"

# Loop through each build.yaml file found
foreach ($buildFile in $buildFiles) {
    # Check if the build file contains the specified image repository
    if (Get-Content $buildFile.FullName | Select-String -Pattern "ghcr.io/hassio-addons" -Quiet) {
        $addonDir = $buildFile.DirectoryName
        $addonName = $buildFile.Directory.Name
        Write-Host "Processing addon: $addonName"

        # Define paths for config.yaml and CHANGELOG.md
        $configFile = Join-Path -Path $addonDir -ChildPath "config.yaml"
        $changelogFile = Join-Path -Path $addonDir -ChildPath "CHANGELOG.md"

        if (-not (Test-Path $configFile)) {
            Write-Warning "  - config.yaml not found in $addonDir"
            continue
        }

        try {
            # Read the content of the config file
            $configContent = Get-Content $configFile -Raw

            # Find the version line
            $versionRegex = [regex]'(?m)(^\s*version:\s*)(\d+\.\d+\.\d+)'
            $match = $versionRegex.Match($configContent)

            if (-not $match.Success) {
                Write-Warning "  - Version information not found in $configFile"
                continue
            }

            $currentVersion = $match.Groups[2].Value
            $versionParts = $currentVersion.Split('.')
            $currentPatch = [int]$versionParts[2]

            if ($Revert) {
                # --- REVERT LOGIC ---
                if ($currentPatch -gt 0) {
                    $newPatch = $currentPatch - 1
                    $newVersion = "$($versionParts[0]).$($versionParts[1]).$newPatch"
                    Write-Host "  - Reverting version from $currentVersion to $newVersion"

                    # Replace the old version with the new one
                    $newConfigContent = $versionRegex.Replace($configContent, ('${1}' + $newVersion), 1)
                    Set-Content -Path $configFile -Value $newConfigContent -NoNewline

                    # Revert Changelog
                    if (Test-Path $changelogFile) {
                        $changelogContent = Get-Content $changelogFile -Raw

                        $headerRegex = '(?m)^(#\s*Changelog\s*(\r?\n))'
                        $headerMatch = [regex]::Match($changelogContent, $headerRegex)

                        if ($headerMatch.Success) {
                            $header = $headerMatch.Value
                            # Get everything after the header
                            $entriesContent = $changelogContent.Substring($headerMatch.Length)

                            # Regex to find the first full entry block. (?s) allows '.' to match newlines.
                            $firstEntryRegex = '(?s)^\s*##\s*\d+\.\d+\.\d+.*?(?=\r?\n\s*##|$)'

                            if ($entriesContent -match $firstEntryRegex) {
                                # Replace the first found entry with an empty string
                                $updatedEntriesContent = $entriesContent -replace $firstEntryRegex, ''

                                # Reconstruct the content, TrimStart() removes leading newlines
                                $updatedChangelogContent = $header + $updatedEntriesContent.TrimStart()

                                Set-Content -Path $changelogFile -Value $updatedChangelogContent
                                Write-Host "  - Removed latest entry from CHANGELOG.md"
                            }
                            else {
                                Write-Warning "  - Could not find a version entry to remove in CHANGELOG.md"
                            }
                        }
                        else {
                            Write-Warning "  - Changelog header not found in CHANGELOG.md"
                        }
                    }
                }
                else {
                    Write-Warning "  - Cannot revert version. Patch version is already 0."
                }
            }
            else {
                # --- INCREMENT LOGIC ---
                $newPatch = $currentPatch + 1
                $newVersion = "$($versionParts[0]).$($versionParts[1]).$newPatch"

                Write-Host "  - Current version: $currentVersion, New version: $newVersion"

                # Replace the old version with the new one
                $newConfigContent = $versionRegex.Replace($configContent, ('${1}' + $newVersion), 1)
                Set-Content -Path $configFile -Value $newConfigContent -NoNewline

                # Update Changelog
                if (Test-Path $changelogFile) {
                    $changelogContent = Get-Content -Path $changelogFile -Raw
                    $newChangelogEntry = "## $newVersion`r`n- Automatically updated addon-base to version $latestBaseVersion"

                    # Regex to capture the header line
                    $headerRegex = '(?m)^(#\s*Changelog\s*\r?\n)'

                    if ($changelogContent -match $headerRegex) {
                        # Replace the header with the header, a blank line, and the new entry, preserving the rest of the file
                        $updatedChangelogContent = $changelogContent -replace $headerRegex, ("`$1$newChangelogEntry`r`n`r`n")
                    }
                    else {
                        # If no header, create a new file content
                        $updatedChangelogContent = "# Changelog`r`n`r`n$newChangelogEntry`r`n"
                    }

                    Set-Content -Path $changelogFile -Value $updatedChangelogContent
                    Write-Host "  - Updated CHANGELOG.md with base version $latestBaseVersion"
                }
                else {
                    Write-Warning "  - CHANGELOG.md not found in $addonDir"
                }
            }
        }
        catch {
            Write-Error "  - Error processing $configFile`: $_"
        }

        Write-Host ""
    }
}

Write-Host "Script execution finished."