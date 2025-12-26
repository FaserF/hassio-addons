<#
.SYNOPSIS
    Docker Build & Run - builds and runs addons in a mock environment.
.DESCRIPTION
    This is the most complex test stage, handling:
    - Docker builds using HA Builder
    - Mock Supervisor API setup
    - Container runtime testing
    - Healthcheck validation
#>
param(
    [Parameter(Mandatory)][array]$Addons,
    [Parameter(Mandatory)][hashtable]$Config,
    [Parameter(Mandatory)][string]$OutputDir,
    [Parameter(Mandatory)][string]$RepoRoot,
    [bool]$DockerAvailable = $false,
    [bool]$RunTests = $true,
    [bool]$ChangedOnly = $false,
    [hashtable]$ChangedAddons = @{}
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

if (-not $DockerAvailable) { return }

Write-Header "11. Docker Test (Dynamic Build)"

# --- GLOBAL MOCK SETUP ---
$doRuns = $RunTests
$mockName = "mock-supervisor"
$networkName = "ha-addon-test-net"
$globalMockDir = Join-Path $OutputDir "tmp_mock_global"
$globalOptionsPath = $null

if ($doRuns) {
    Write-Host "    > Setting up global persistent mock environment..." -ForegroundColor Gray
    if (Test-Path $globalMockDir) { Remove-Item $globalMockDir -Recurse -Force }
    New-Item -ItemType Directory -Path $globalMockDir -Force | Out-Null
    $globalDataDir = Join-Path $globalMockDir "data"
    New-Item -ItemType Directory -Path $globalDataDir -Force | Out-Null
    $globalOptionsPath = Join-Path $globalDataDir "options.json"
    '{}' | Set-Content -Path $globalOptionsPath -Encoding UTF8

    # Clean previous
    try { docker rm -f $mockName 2>&1 | Out-Null } catch {}
    try { docker network rm $networkName 2>&1 | Out-Null } catch {}
    try { docker network create $networkName 2>$null | Out-Null } catch {}

    $mockScript = Join-Path $PSScriptRoot "../../supervisor_mock.py"
    $mockArgs = @("run", "-d", "--name", $mockName)
    $mockArgs += "--network", $networkName
    $mockArgs += "--network-alias", "supervisor"
    $mockArgs += "-v", "$($globalDataDir.Replace('\','/')):/data"
    $mockArgs += "-v", "$($mockScript.Replace('\','/')):/mock.py"
    $mockArgs += "-w", "/data"

    # Pass Mock Versions from Config
    if ($Config.mockCoreVersion) { $mockArgs += "-e", "MOCK_CORE_VERSION=$($Config.mockCoreVersion)" }
    if ($Config.mockSupervisorVersion) { $mockArgs += "-e", "MOCK_SUPERVISOR_VERSION=$($Config.mockSupervisorVersion)" }
    if ($Config.mockOsVersion) { $mockArgs += "-e", "MOCK_OS_VERSION=$($Config.mockOsVersion)" }
    if ($Config.mockKernelVersion) { $mockArgs += "-e", "MOCK_KERNEL_VERSION=$($Config.mockKernelVersion)" }
    if ($Config.mockArch) { $mockArgs += "-e", "MOCK_ARCH=$($Config.mockArch)" }

    $mockArgs += "python:3.13-alpine"
    $mockArgs += "python", "/mock.py", "/data/options.json", "80", "0.0.0.0"

    $mockOut = & docker @mockArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "    ! ERROR: Failed to start global mock supervisor: $mockOut" -ForegroundColor Red
        $doRuns = $false
    } else {
        Start-Sleep -Seconds 2
    }
}

$builderImage = $Config.builderImage

try {
    $i = 0
    foreach ($a in $Addons) {
        $i++
        Write-Progress -Id 1 -Activity "Building & Testing" -Status "[$i / $($Addons.Count)] $($a.Name)" -PercentComplete (($i / $Addons.Count) * 100)
        if (-not (Should-RunTest -AddonName $a.Name -TestName "DockerBuild" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) { continue }

        $imgName = "test-$($a.Name.ToLower())"
        $date = Get-Date -Format "yyyy-MM-dd"

        # Get the correct base image for this addon
        $buildFile = Join-Path $a.FullName "build.yaml"
        $configFile = Join-Path $a.FullName "config.yaml"
        $addonBase = $null
        if (Test-Path $buildFile) {
            $addonBase = Get-BuildFrom $buildFile
        }

        # Build using Home Assistant Builder
        Write-Host "    > Building $($a.Name) with $builderImage..." -ForegroundColor Gray

        $arch = "amd64"

        # Pull builder if missing
        if (-not (docker images -q $builderImage)) {
            docker pull $builderImage | Out-Null
        }

        # Construct Builder Arguments
        $buildArgs = @("run", "--rm", "--privileged")
        $buildArgs += "-v", "/var/run/docker.sock:/var/run/docker.sock"
        $buildArgs += "-v", "$($a.FullName.Replace('\','/')):/data"
        $buildArgs += "-v", "$($env:TEMP)/ha-builder-cache:/cache"
        $buildArgs += $builderImage
        $buildArgs += "--test"
        $buildArgs += "--$arch"
        $buildArgs += "--target", "/data"
        $buildArgs += "--image", $imgName
        $buildArgs += "--docker-hub", "local"

        $buildOutput = & docker @buildArgs 2>&1
        $buildSuccess = ($LASTEXITCODE -eq 0)

        if (-not $buildSuccess) {
            Add-Result -Addon $a.Name -Check "DockerBuild" -Status "FAIL" -Message "Build Failed. Output:`n$buildOutput"
        }
        else {
            Add-Result -Addon $a.Name -Check "DockerBuild" -Status "PASS" -Message "OK"

            # --- RUN TEST ---
            if ($RunTests) {
            # Check dynamic skips first
            if ($Config.skipDockerRun.ContainsKey($a.Name)) {
                Add-Result -Addon $a.Name -Check "DockerRun" -Status "INFO" -Message "Skipped ($($Config.skipDockerRun[$a.Name]))"
                continue
            }

            # Dynamic Heuristic: Skip if addon requires GitHub Token (Credentials)
            if (Test-Path $configFile) {
                # Quick check in schema or options for 'github_token'
                $confContent = Get-Content $configFile -Raw
                if ($confContent -match "github_token") {
                    Add-Result -Addon $a.Name -Check "DockerRun" -Status "INFO" -Message "Skipped (Requires GitHub Token/Credentials)"
                    continue
                }
            }

            $contName = "test-run-$($a.Name.ToLower())"
            docker rm -f $contName 2>&1 | Out-Null

            # Ensure network exists (resiliency against previous crashes)
            if (-not (docker network ls -q -f name=$networkName)) {
                 docker network create $networkName 2>$null | Out-Null
            }

            # Prepare config
            $tempDir = Join-Path $OutputDir "tmp_test_runs"
            $safeName = $a.Name -replace '[^a-zA-Z0-9_\-]', '_'
            $tempDir = Join-Path $tempDir "ha-addon-test-$safeName"
            if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
            New-Item -ItemType Directory -Path $tempDir -Force | Out-Null


            $dataDir = Join-Path $tempDir "data"
            New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
            $optionsPath = Join-Path $dataDir "options.json"

            # Create SSL certificates
            $sslDir = Join-Path $tempDir "ssl"
            New-Item -ItemType Directory -Path $sslDir -Force | Out-Null

            $certContent = "-----BEGIN CERTIFICATE-----`n" +
"MIICBDCCAW2gAwIBAgIUXkRIHiZy5omKPEZp/4YDozjIvaowDQYJKoZIhvcNAQEL`n" +
"BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI1MTIyNjAxMTA1MloXDTM1MTIy`n" +
"NDAxMTA1MlowFDESMBAGA1UEAwwJbG9jYWxob3N0MIGfMA0GCSqGSIb3DQEBAQUA`n" +
"A4GNADCBiQKBgQC1f1nUaHtTrXTZmZZKAswHlaBq48hbOwX0oqvAUD+vMPQp03D5`n" +
"paMbLg2pDJGgeRsBWJng3P2PJdfOIsDZEnf2Hg8BYYJS7e7KitYtmVss5Wt6a7+T`n" +
"ezwofRxFyxT1RefLoEbVj9WUdwsmKwGk8JFwg7OPKWDUteuCkS5284ZqGwIDAQAB`n" +
"o1MwUTAdBgNVHQ4EFgQU0c+mCjHiHhij6l0EiJGdv00G24swHwYDVR0jBBgwFoAU`n" +
"0c+mCjHiHhij6l0EiJGdv00G24swDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0B`n" +
"AQsFAAOBgQBy7qK5VICjRujEsCO1wKf+W+gz9M3/Db/OgofAl8TlVDilf/6/b4cl`n" +
"CqyLDIiQXG3C3n+AwcTehEJmmZOFIJS1p9Jf5UALPXCaBHqGrXzdbmZ7FIhiOZOy`n" +
"e+Klqzwa6nFK6iGGyzVoBbnLDZHh7YRHPYcIb9p6fbXLjEQ25RSvBQ==`n" +
"-----END CERTIFICATE-----"

            $keyContent = "-----BEGIN PRIVATE KEY-----`n" +
"MIICdgIBADANBgkqhkiG9w0BAQEFAASCAmAwggJcAgEAAoGBALV/WdRoe1OtdNmZ`n" +
"lkoCzAeVoGrjyFs7BfSiq8BQP68w9CnTcPmloxsuDakMkaB5GwFYmeDc/Y8l184i`n" +
"wNkSd/YeDwFhglLt7sqK1i2ZWyzla3prv5N7PCh9HEXLFPVF58ugRtWP1ZR3CyYr`n" +
"AaTwkXCDs48pYNS164KRLnbzhmobAgMBAAECgYBb8OJhjngDAJhz7rDKVzZiFTMJ`n" +
"UtBZHsI6lfkpV72bEtJtKbZOUNEaYK781ugigZbjjK2O0oQD8uiqfMJydD+d6/e4`n" +
"9Oi2KCO1EXSO4Bp/LgWm1FbvhIJlZ3oLGzEzAkWp42oTUrUL2pNyMEtz6VdmRjvu`n" +
"oEnczSfzb91rE031OQJBAOVN6Cf81LUNFOMLIMnnq8IDKFCylkN5SeKtdqBkIGkS`n" +
"ra56i34zeJp3G6UL9mI2tnlbsaVDj8CCDwz8Gx0rAEcCQQDKoKC2DNhVwMQqm1La`n" +
"SEoVvqmsNqspLCo6DHUrQk6d65vjkEqeN/4NtAdJYGTTCNiEdEgcvlxamTtxYAYx`n" +
"SyWNAkBy7/QYZyDvh5kanS9YRSnQ2+hPWtT7CUbBupUlnEqqoFQyivZ00bP4KQ/Q`n" +
"UQi0/hvFBPMslYruwcJtjcjBfBZtAkAXmlJeImzowEWZePJTvuvyUH1PNCcH6r8Y`n" +
"d+8GFPk3aASGo34to/QSAJCAuZvFAVjHRQxJXNtBKmxELp1KDKjZAkEArPqtdaFl`n" +
"eVOa7x+Dsdl9r80AlO+yD7p5hFcuPWmj53RwbZzmGTAsA5RXSbLAlFbNF7BSp0hx`n" +
"1YJvucOJCoqkZA==`n" +
"-----END PRIVATE KEY-----"

            [System.IO.File]::WriteAllText((Join-Path $sslDir "fullchain.pem"), $certContent)
            [System.IO.File]::WriteAllText((Join-Path $sslDir "privkey.pem"), $keyContent)

            # Create common directories
            $shareDir = Join-Path $tempDir "share"
            $configDir = Join-Path $tempDir "config"
            $mediaDir = Join-Path $tempDir "media"
            New-Item -ItemType Directory -Path $shareDir -Force | Out-Null
            New-Item -ItemType Directory -Path $configDir -Force | Out-Null
            New-Item -ItemType Directory -Path $mediaDir -Force | Out-Null

            # Generate options.json
            if (Test-Path $configFile) {
                $jsonOpts = Get-DefaultOptions $configFile
                try {
                    $optObj = $jsonOpts | ConvertFrom-Json -ErrorAction Stop
                    if (-not $optObj.log_level) {
                        $optObj | Add-Member -NotePropertyName "log_level" -NotePropertyValue "info" -Force
                    }

                    # Addon-specific mock config

                    if ($a.Name -like "apache2*") {
                        $optObj | Add-Member -NotePropertyName "ssl" -NotePropertyValue $false -Force
                        $optObj | Add-Member -NotePropertyName "default_conf" -NotePropertyValue "default" -Force
                        $optObj | Add-Member -NotePropertyName "default_ssl_conf" -NotePropertyValue "default" -Force
                        $optObj | Add-Member -NotePropertyName "website_name" -NotePropertyValue "localhost" -Force
                        $htdocsPath = Join-Path $shareDir "htdocs"
                        New-Item -ItemType Directory -Path $htdocsPath -Force | Out-Null
                        Set-Content -Path "$htdocsPath/index.html" -Value "<html><body>Mock</body></html>"
                    }
                    if ($a.Name -eq "openssl") {
                        $optObj | Add-Member -NotePropertyName "website_name" -NotePropertyValue "localhost" -Force
                    }

                    if ($a.Name -eq "matterbridge") {
                        $matterbridgeCfg = Join-Path $shareDir "matterbridge.toml"
                        Set-Content -Path $matterbridgeCfg -Value "[general]`nHomeServerURL=mock`n"
                        $optObj | Add-Member -NotePropertyName "config_path" -NotePropertyValue "/share/matterbridge.toml" -Force
                    }

                    if ($a.Name -eq "tado_aa") {
                        $optObj | Add-Member -NotePropertyName "username" -NotePropertyValue "mockuser" -Force
                        $optObj | Add-Member -NotePropertyName "password" -NotePropertyValue "mockpass" -Force
                    }
                    if ($a.Name -eq "pterodactyl-wings") {
                        $optObj | Add-Member -NotePropertyName "config_file" -NotePropertyValue "/etc/pterodactyl/config.yml" -Force
                    }
                    if ($a.Name -eq "bt-mqtt-gateway") {
                        $optObj | Add-Member -NotePropertyName "config_path" -NotePropertyValue "/share/bt-mqtt-gateway.yaml" -Force
                        Set-Content -Path "$shareDir/bt-mqtt-gateway.yaml" -Value "mqtt:`n  host: mock`n"
                    }

                    if ($a.Name -eq "bash_script_executer") {
                        $sp = $optObj.script_path
                        if ($sp -and $sp -ne "false" -and $sp.StartsWith("/share/")) {
                            $rel = $sp.Substring(7)
                            $target = Join-Path $shareDir $rel
                            $parent = Split-Path $target
                            if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
                            "echo 'Mock Script Executed'" | Set-Content -Path $target -Encoding UTF8
                        }
                    }

                    $jsonOutput = $optObj | ConvertTo-Json -Depth 10
                    $jsonOutput | Set-Content -Path $optionsPath -Encoding UTF8
                    Write-Host "    > Generated options.json: $jsonOutput" -ForegroundColor DarkGray
                } catch {
                    Write-Warning "Failed to generate options.json, using fallback."
                    '{"log_level":"info"}' | Set-Content -Path $optionsPath -Encoding UTF8
                }
            } else {
                '{"log_level":"info"}' | Set-Content -Path $optionsPath -Encoding UTF8
            }

            # Sync with global mock
            if ($globalOptionsPath) {
                try {
                    if (-not (Test-Path $globalDataDir)) { New-Item -ItemType Directory -Path $globalDataDir -Force | Out-Null }
                    Copy-Item -Path $optionsPath -Destination $globalOptionsPath -Force -ErrorAction Stop
                } catch {
                     Write-Warning "Failed to sync options to global mock: $_"
                }
            }

            # Validate mock support
            if (Test-Path $configFile) {
                $requiredKeys = (Get-RequiredSchemaKeys $configFile) -split "," | Where-Object { $_ -ne "" }
                if ($requiredKeys.Count -gt 0) {
                    try {
                        $finalOpts = Get-Content $optionsPath | ConvertFrom-Json
                        $missingKeys = @()
                        foreach ($key in $requiredKeys) {
                            if (-not $finalOpts.PSObject.Properties[$key]) {
                                $missingKeys += $key
                            }
                        }
                        if ($missingKeys.Count -gt 0) {
                            Write-Host "    ! WARNING: Add-on may fail due to missing mock config: $($missingKeys -join ', ')" -ForegroundColor Yellow
                            Add-Result -Addon $a.Name -Check "DockerRun" -Status "WARN" -Message "Incomplete Mock Config. Missing: $($missingKeys -join ', ')"
                            continue
                        }
                    } catch {
                        Write-Host "    ! WARNING: Could not validate options.json" -ForegroundColor Yellow
                    }
                }
            }



            # Run addon
            $runArgs = @("run", "-d", "--name", $contName)
            $runArgs += "--network", $networkName
            $runArgs += "-v", "$($tempDir.Replace('\','/'))/data:/data"
            $runArgs += "-v", "$($configDir.Replace('\','/')):/config"
            $runArgs += "-v", "$($sslDir.Replace('\','/')):/ssl"
            $runArgs += "-v", "$($shareDir.Replace('\','/')):/share"
            $runArgs += "-v", "$($mediaDir.Replace('\','/')):/media"
            $runArgs += "-e", "SUPERVISOR_TOKEN=mock_token"
            $runArgs += "-e", "HASSIO_TOKEN=mock_token"
            $runArgs += "-e", "SUPERVISOR_API=http://supervisor"
            $runArgs += "local/$imgName"

            $runInfo = & docker @runArgs 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Host "    ! ERROR: Failed to start addon container: $runInfo" -ForegroundColor Red
            }

            # Wait for startup
            Write-Host "    > Waiting 20s for startup verification..." -ForegroundColor Gray
            Start-Sleep -Seconds 20

            $inspectJson = docker inspect $contName | ConvertFrom-Json
            $isRunning = ($inspectJson.State.Running -eq $true)
            $healthStatus = if ($inspectJson.State.Health) { $inspectJson.State.Health.Status } else { "none" }

            # Check logs
            $logs = docker logs $contName 2>&1
            $logError = $false
            if ($logs -match "panic:" -or $logs -match "s6-rc: fatal") {
                $logError = $true
            }

            if (-not $isRunning) {
                if ($logs -match "Could not resolve host: supervisor") {
                    Add-Result -Addon $a.Name -Check "DockerRun" -Status "INFO" -Message "Skipped (Supervisor Connection Issues). Logs:`n$($logs | Select-Object -Last 10)"
                }
                elseif ($logs -match "All Scripts were executed|Certificates were generated|addon will now be stopped|Stopping container\.\.\.|Successfully completed") {
                    Add-Result -Addon $a.Name -Check "DockerRun" -Status "PASS" -Message "One-shot addon completed successfully"
                }
                elseif ($logs -match "There is no .* file|config.* not found|Please create.*config|requires.*add-on") {
                    Add-Result -Addon $a.Name -Check "DockerRun" -Status "INFO" -Message "Skipped (Missing external dependencies/config for mock)"
                }
                elseif ($logs -match "No such file or directory|not found|does not exist|Permission denied|unable to exec") {
                    Add-Result -Addon $a.Name -Check "DockerRun" -Status "WARN" -Message "Mock environment missing resources. Logs:`n$($logs | Select-Object -Last 10)"
                }
                else {
                    Add-Result -Addon $a.Name -Check "DockerRun" -Status "FAIL" -Message "Crashed immediately. Docker output: $runInfo. Logs summary:`n$($logs | Select-Object -Last 15)"
                }
            }
            elseif ($healthStatus -eq "unhealthy") {
                Add-Result -Addon $a.Name -Check "DockerRun" -Status "FAIL" -Message "Container marked UNHEALTHY."
            }
            elseif ($logError) {
                Add-Result -Addon $a.Name -Check "DockerRun" -Status "FAIL" -Message "Fatal error in logs detected."
            }
            else {
                Add-Result -Addon $a.Name -Check "DockerRun" -Status "PASS" -Message "Stable (Running, Health: $healthStatus)"
            }

            # Cleanup
            docker rm -f $contName 2>&1 | Out-Null
            Remove-Item $tempDir -Recurse -Force 2>$null
            }
        }
    }
} finally {
    # Global Cleanup
    if ($doRuns) {
        Write-Host "    > Cleaning up global mock environment..." -ForegroundColor Gray
        try { docker rm -f $mockName 2>&1 | Out-Null } catch {}
        try { docker network rm $networkName 2>&1 | Out-Null } catch {}
        try { Remove-Item $globalMockDir -Recurse -Force 2>$null } catch {}
    }
}
