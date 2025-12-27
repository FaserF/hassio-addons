<#
.SYNOPSIS
    Supervisor Integration Test - runs add-ons in a real Home Assistant Supervisor environment.
.DESCRIPTION
    This test module uses the official HA devcontainer to:
    - Start a real Supervisor environment
    - Install add-ons using the `ha` CLI
    - Start add-ons and verify they run correctly
    - Test Ingress endpoints for ingress-enabled add-ons
    - Clean up after testing

    This is a resource-intensive test and should only be run when explicitly requested
    via the -SupervisorTest parameter.
#>
param(
    [Parameter(Mandatory)][array]$Addons,
    [Parameter(Mandatory)][hashtable]$Config,
    [Parameter(Mandatory)][string]$RepoRoot,
    [Parameter(Mandatory)][string]$OutputDir,
    [bool]$DockerAvailable = $false,
    [bool]$ChangedOnly = $false,
    [hashtable]$ChangedAddons = @{}
)

# Source common module
. "$PSScriptRoot/../lib/common.ps1"

if (-not $DockerAvailable) {
    Add-Result -Addon "System" -Check "SupervisorTest" -Status "SKIP" -Message "Docker not available"
    return
}

Write-Header "17. Supervisor Integration Test (Real Environment)"

# Configuration
$devcontainerImage = "ghcr.io/home-assistant/devcontainer:addons"
$containerName = "ha-supervisor-test-local"
$networkName = "ha-supervisor-test-net"
$haPort = 7123
$supervisorStartupTimeout = $Config.supervisorTests.supervisorStartupTimeout ?? 300
$addonInstallTimeout = $Config.supervisorTests.addonInstallTimeout ?? 300
$addonStartTimeout = $Config.supervisorTests.addonStartTimeout ?? 600

# Get skip list
$skipList = @{}
if ($Config.supervisorTests -and $Config.supervisorTests.skipSupervisorTest) {
    $skipList = $Config.supervisorTests.skipSupervisorTest
}

Write-Host "    > This test uses a real Home Assistant Supervisor environment" -ForegroundColor Cyan
Write-Host "    > Expected duration: 5-15 minutes per add-on" -ForegroundColor Gray
Write-Host ""

# Check if devcontainer image exists, pull if not
Write-Host "    > Checking for devcontainer image..." -ForegroundColor Gray
$imageExists = docker images -q $devcontainerImage 2>$null
if (-not $imageExists) {
    Write-Host "    > Pulling devcontainer image (this may take a while)..." -ForegroundColor Yellow
    Write-Progress -Activity "Supervisor Integration Test" -Status "Pulling docker image $devcontainerImage..."
    try {
        $pullResult = docker pull $devcontainerImage 2>&1
        if ($LASTEXITCODE -ne 0) {
            Add-Result -Addon "System" -Check "SupervisorTest" -Status "FAIL" -Message "Failed to pull devcontainer image: $pullResult"
            return
        }
    }
    finally {
        Write-Progress -Activity "Supervisor Integration Test" -Status "Image pull complete" -Completed
    }
}
else {
    Write-Host "    > Found existing local image. Reusing." -ForegroundColor Green
}

try {
    # Cleanup any previous runs
    Write-Host "    > Cleaning up previous test environment..." -ForegroundColor Gray
    docker stop $containerName 2>$null | Out-Null
    docker rm -f $containerName 2>$null | Out-Null
    docker network rm $networkName 2>$null | Out-Null

    # Create network
    docker network create $networkName 2>$null | Out-Null

    # Create docker volume for performance (overlay2 vs vfs)
    $dockerVolName = "ha-supervisor-test-docker-lib"
    docker volume create $dockerVolName | Out-Null

    # Create data directories
    $dataDir = Join-Path $OutputDir "supervisor_test_data"
    if (Test-Path $dataDir) { Remove-Item $dataDir -Recurse -Force }
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null

    $addonsDir = Join-Path $dataDir "addons/local"
    $configDir = Join-Path $dataDir "config"
    $shareDir = Join-Path $dataDir "share"
    $sslDir = Join-Path $dataDir "ssl"

    New-Item -ItemType Directory -Path $addonsDir -Force | Out-Null
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    New-Item -ItemType Directory -Path $shareDir -Force | Out-Null
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null

    # Create dummy certs for all add-ons (universal SSL support)
    $certContent = @"
-----BEGIN CERTIFICATE-----
MIIDxzCCAq+gAwIBAgIJAPc6vmqC8w+zMA0GCSqGSIb3DQEBCwUAMIGXMQswCQYD
VQQGEwJYWDEVMBMGA1UECAwMRGVmYXVsdCBDaXR5MRwwGgYDVQQKExNEZWZhdWx0
IENvbXBhbnkgTHRkMRIwEAYDVQQHDAlMb2NhbGhvc3QxLDAqBgNVBAMMI0hvbWUg
QXNzaXN0YW50IEFkZC1vbiBUZXN0IFJvb3QgQ0EwHhcNMjQxMjI3MTAwMDAwWhcN
MzQxMjI1MTAwMDAwWjBZMQswCQYDVQQGEwJYWDEVMBMGA1UECAwMRGVmYXVsdCBD
aXR5MRwwGgYDVQQKExNEZWZhdWx0IENvbXBhbnkgTHRkMREwDwYDVQQDDAh0ZXN0
LmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALyLdGvuwE5+Qz5Z
k1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Z
k1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Z
k1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Z
k1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Z
k1pZ6+0CAwEAAaNQME4wHQYDVR0OBBYEFJ6g4G4H3g5i5j6k5l6m7n8o9p0qMB8G
A1UdIwQYMBaAFJ6g4G4H3g5i5j6k5l6m7n8o9p0qMAwGA1UdEwQFMAMBAf8wDQYJ
KoZIhvcNAQELBQADggEBAJy55+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1
pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1
pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1
pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1
pZ6+3q4=
-----END CERTIFICATE-----
"@
    $keyContent = @"
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC8i3Rr7sBOfkM+
WZNaWevt6u8+fkM+WZNaWevt6u8+fkM+WZNaWevt6u8+fkM+WZNaWevt6u8+fkM+
WZNaWevt6u8+fkM+WZNaWevt6u8+fkM+WZNaWevt6u8+fkM+WZNaWevt6u8+fkM+
WZNaWevt6u8+fkM+WZNaWevt6u8+fkM+WZNaWevt6u8+fkM+WZNaWevt6u8+fkM+
WZNaWevtAgMBAAECggEBAK2j5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+
3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+
3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+
3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+
3q4CgYEAz6/5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1p
Z6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1p
Z6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q4CgYEAz6/5
Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5
Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5
Zk1pZ6+3q4CgYEAxk/5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+
Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+
Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q4CgYEAz6/5Zk1pZ6+3q7z5
+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5
+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q4Cg
YEAxk/5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q
7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q
7z5+Qz5Zk1pZ6+3q7z5+Qz5Zk1pZ6+3q4=
-----END PRIVATE KEY-----
"@

    $certContent | Out-File -FilePath (Join-Path $sslDir "fullchain.pem") -Encoding ascii -Force
    $keyContent | Out-File -FilePath (Join-Path $sslDir "privkey.pem") -Encoding ascii -Force

    # Create persistent log file for debugging crashes
    $logFileHost = Join-Path $dataDir "supervisor.log"
    New-Item -ItemType File -Path $logFileHost -Force | Out-Null
    $logFileUnix = $logFileHost.Replace('\', '/')

    # Copy add-ons to local addons directory
    Write-Host "    > Preparing add-ons for testing..." -ForegroundColor Gray
    foreach ($addon in $Addons) {
        $addonPath = $addon.FullName
        $targetPath = Join-Path $addonsDir $addon.Name

        Write-Host "      Copying $($addon.Name)..." -ForegroundColor DarkGray
        Copy-Item -Path $addonPath -Destination $targetPath -Recurse -Force
    }

    # Start the devcontainer
    Write-Host "    > Starting Supervisor environment..." -ForegroundColor Gray

    $dataDirUnix = $dataDir.Replace('\', '/')

    $runArgs = @(
        "run", "-d",
        "--name", $containerName,
        "--privileged",
        "--network", $networkName,
        "-p", "${haPort}:7123",
        "-v", "${dataDirUnix}/addons:/mnt/supervisor/addons",
        "-v", "${dataDirUnix}/config:/mnt/supervisor/homeassistant",
        "-v", "${dataDirUnix}/share:/mnt/supervisor/share",
        "-v", "${dataDirUnix}/ssl:/mnt/supervisor/ssl",
        "-v", "${logFileUnix}:/tmp/supervisor.log",
        "-v", "${dockerVolName}:/var/lib/docker",
        "-e", "SUPERVISOR_SHARE_DATA=1",
        $devcontainerImage,
        "sleep", "infinity"
    )

    $startResult = & docker @runArgs 2>&1
    if ($LASTEXITCODE -ne 0) {
        Add-Result -Addon "System" -Check "SupervisorTest" -Status "FAIL" -Message "Failed to start container: $startResult"
        return
    }

    Start-Sleep -Seconds 5

    # Start Supervisor inside the container
    # Create missing directory for Docker (fix for 'stat' error)
    # Note: Named volume mount handles this, but keeping for safety
    docker exec $containerName mkdir -p /var/lib/docker

    # Start Supervisor inside the container (detached with logging + TTY fix via script)
    Write-Host "    > Initializing Supervisor..." -ForegroundColor Gray
    # Use 'script' to maintain TTY for stty commands while logging to file
    # -f ensures immediate flush so logs are preserved even on crash
    docker exec -d $containerName script -f -q -c "supervisor_run" /tmp/supervisor.log

    # Wait for Supervisor to be ready
    Write-Host "    > Waiting for Supervisor to be ready (up to ${supervisorStartupTimeout}s)..." -NoNewline -ForegroundColor Gray
    $supervisorReady = $false
    for ($i = 0; $i -lt $supervisorStartupTimeout; $i++) {
        $percent = [int](($i / $supervisorStartupTimeout) * 100)
        Write-Progress -Activity "Initializing Supervisor" -Status "Waiting for API ($i/${supervisorStartupTimeout}s)" -PercentComplete $percent

        $checkResult = docker exec $containerName ha supervisor info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host " Ready!" -ForegroundColor Green
            $supervisorReady = $true
            break
        }

        # Fail fast if container crashed
        $containerStatus = docker inspect -f '{{.State.Status}}' $containerName 2>$null
        if ($containerStatus -ne 'running') {
            Write-Host " Container stopped unexpectedly!" -ForegroundColor Red
            break
        }

        # Write-Host "." -NoNewline -ForegroundColor Gray
        Start-Sleep -Seconds 1
    }
    Write-Progress -Activity "Initializing Supervisor" -Completed

    if (-not $supervisorReady) {
        Write-Host " Timeout!" -ForegroundColor Red

        Write-Host "    > Fetching internal supervisor logs..." -ForegroundColor Cyan

        # Read from host file since container might be dead/exited
        if (Test-Path $logFileHost) {
            $intLogs = Get-Content $logFileHost -Tail 50
        } else {
            $intLogs = "No log file found at $logFileHost"
        }

        $sysLogs = docker logs $containerName 2>&1 | Select-Object -Last 20

        Add-Result -Addon "System" -Check "SupervisorTest" -Status "FAIL" -Message "Supervisor failed to start.`nInternal Logs ($logFileHost):`n$intLogs`nDocker Logs:`n$sysLogs"
        return
    }

    # Refresh add-on store
    Write-Host "    > Refreshing add-on store..." -ForegroundColor Gray
    docker exec $containerName ha addons reload 2>&1 | Out-Null
    Start-Sleep -Seconds 5

    # Debug: List available addons
    if ($PSBoundParameters['Debug']) {
        Write-Host "    > Debug: Available addons:" -ForegroundColor DarkGray
        docker exec $containerName ha addons list 2>&1
    }

    # Check dependencies
    $needsMysql = $false
    foreach ($a in $Addons) {
        if ($a.Name -match "wiki.js|pterodactyl-panel") { $needsMysql = $true }
    }

    $mysqlFailed = $false
    if ($needsMysql) {
        Write-Host "    > Installing Dependency: MariaDB (core_mariadb)..." -ForegroundColor Cyan
        Write-Progress -Activity "Supervisor Integration Test" -Status "Installing Dependency: MariaDB..."

        $inst = docker exec $containerName ha addons install core_mariadb 2>&1
        if ($LASTEXITCODE -eq 0) {
             $start = docker exec $containerName ha addons start core_mariadb 2>&1
             if ($LASTEXITCODE -ne 0) {
                 Write-Warning "Failed to start MariaDB: $start"
                 $mysqlFailed = $true
             } else {
                 Start-Sleep -Seconds 30
             }
        } else {
             Write-Warning "Failed to install MariaDB: $inst"
             $mysqlFailed = $true
        }
    }

    # Test each add-on
    foreach ($addon in $Addons) {
        if (-not (Should-RunTest -AddonName $addon.Name -TestName "SupervisorTest" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) {
            continue
        }

        # Check unsupported
        if ($addon.FullName -match "\\.unsupported\\") {
            Add-Result -Addon $addon.Name -Check "SupervisorTest" -Status "SKIP" -Message "Unsupported add-on"
            continue
        }

        # Check dependency failure
        if ($mysqlFailed -and ($addon.Name -match "wiki.js|pterodactyl-panel")) {
             Add-Result -Addon $addon.Name -Check "SupervisorTest" -Status "SKIP" -Message "Dependency (MariaDB) failed"
             continue
        }

        # Check skip list
        if ($skipList.ContainsKey($addon.Name)) {
            Add-Result -Addon $addon.Name -Check "SupervisorTest" -Status "INFO" -Message "Skipped ($($skipList[$addon.Name]))"
            continue
        }

        Write-Host ""
        Write-Host "    ========================================" -ForegroundColor Cyan
        Write-Host "    Testing: $($addon.Name)" -ForegroundColor Cyan
        Write-Host "    ========================================" -ForegroundColor Cyan

        $slug = "local_$($addon.Name)"
        $testPassed = $true
        $testMessage = ""

        try {
            # Install add-on
            Write-Host "    > Installing $($addon.Name)..." -ForegroundColor Gray
            $installJob = Start-Job -ScriptBlock {
                param($containerName, $slug, $debugPref)
                if ($debugPref) { $VerbosePreference = "Continue"; $DebugPreference = "Continue" }
                docker exec $containerName ha addons install $slug 2>&1
            } -ArgumentList $containerName, $slug, $PSBoundParameters['Debug']

            $installResult = Wait-Job $installJob -Timeout $addonInstallTimeout
            if ($installResult.State -eq "Completed") {
                $installOutput = Receive-Job $installJob
                Remove-Job $installJob -Force

                if ($installOutput -match "error|failed|Error") {
                    $testPassed = $false
                    $testMessage = "Install failed: $installOutput"
                }
                else {
                    Write-Host "    ✅ Install successful" -ForegroundColor Green

                    # Configure add-on if needed
                    $configFile = Join-Path $addon.FullName "config.yaml"
                    if (Test-Path $configFile) {
                        $configContent = Get-Content $configFile -Raw
                        if ($configContent -match "website_name") {
                            Write-Host "    > Configuring required options (website_name)..." -ForegroundColor Gray
                            docker exec $containerName ha addons options $slug --options "website_name=example.com" 2>&1
                        }
                    }

                    # Start add-on
                    Write-Host "    > Starting $($addon.Name)..." -ForegroundColor Gray
                    $startJob = Start-Job -ScriptBlock {
                        param($containerName, $slug, $debugPref)
                        if ($debugPref) { $VerbosePreference = "Continue"; $DebugPreference = "Continue" }
                        docker exec $containerName ha addons start $slug 2>&1
                    } -ArgumentList $containerName, $slug, $PSBoundParameters['Debug']

                    $startResult = Wait-Job $startJob -Timeout $addonStartTimeout
                    if ($startResult.State -eq "Completed") {
                        $startOutput = Receive-Job $startJob
                        Remove-Job $startJob -Force

                        Start-Sleep -Seconds 2

                        # Poll for status (wait for start/pull)
                        $pollingTimeout = $addonStartTimeout
                        $started = $false
                        $state = "unknown"
                        $infoJson = ""

                        for ($i = 0; $i -lt $pollingTimeout; $i+=5) {
                            $infoJson = docker exec $containerName ha addons info $slug --raw-json 2>$null
                            if ($infoJson) {
                                $info = $infoJson | ConvertFrom-Json
                                $state = $info.data.state
                                if ($state -eq "started") {
                                    $started = $true
                                    break
                                }
                            }

                            Write-Host "." -NoNewline -ForegroundColor Gray
                            Start-Sleep -Seconds 5
                        }
                        Write-Host "" # Newline

                        if ($started) {
                            $infoJson = docker exec $containerName ha addons info $slug --raw-json 2>$null
                            $info = $infoJson | ConvertFrom-Json
                            $state = $info.data.state


                            if ($state -eq "started") {
                                Write-Host "    ✅ Add-on running" -ForegroundColor Green

                                # Check ingress
                                $hasIngress = $info.data.ingress
                                if ($hasIngress -eq $true) {
                                    Write-Host "    > Testing ingress endpoint..." -ForegroundColor Gray
                                    $ingressUrl = $info.data.ingress_url
                                    if ($ingressUrl) {
                                        $curlResult = docker exec $containerName curl -s -o /dev/null -w "%{http_code}" "http://localhost:8099$ingressUrl" 2>&1
                                        if ($curlResult -match "^[23]") {
                                            Write-Host "    ✅ Ingress reachable (HTTP $curlResult)" -ForegroundColor Green
                                            $testMessage = "PASS (Ingress OK, State: $state)"
                                        }
                                        else {
                                            Write-Host "    ⚠️ Ingress returned HTTP $curlResult" -ForegroundColor Yellow
                                            $testMessage = "WARN (Ingress HTTP $curlResult, State: $state)"
                                        }
                                    }
                                    else {
                                        $testMessage = "PASS (State: $state, Ingress URL not available)"
                                    }
                                }
                                else {
                                    $testMessage = "PASS (State: $state)"
                                }
                            }
                            else {
                                $testPassed = $false
                                $logs = docker exec $containerName ha addons logs $slug 2>&1 | Select-Object -Last 20
                                if ($PSBoundParameters['Debug']) {
                                    Write-Host "    > Debug: Addon Info Raw: $infoJson" -ForegroundColor DarkGray
                                }

                                Write-Host "    > Supervisor Logs (Last 50):" -ForegroundColor Cyan
                                if (Test-Path $logFileHost) {
                                    Get-Content $logFileHost -Tail 50
                                } else {
                                    Write-Host "No log file found at $logFileHost" -ForegroundColor Yellow
                                }
                            }
                        }
                        else {
                            $testPassed = $false
                            $testMessage = "Could not get add-on info"
                        }
                    }
                    else {
                        Remove-Job $startJob -Force
                        $testPassed = $false
                        $testMessage = "Start timed out after ${addonStartTimeout}s"
                    }
                }
            }
            else {
                Remove-Job $installJob -Force
                $testPassed = $false
                $testMessage = "Install timed out after ${addonInstallTimeout}s"
            }
        }
        catch {
            $testPassed = $false
            $testMessage = "Exception: $_"
        }
        finally {
            # Cleanup this add-on
            Write-Host "    > Cleaning up $($addon.Name)..." -ForegroundColor Gray
            docker exec $containerName ha addons stop $slug 2>$null | Out-Null
            docker exec $containerName ha addons uninstall $slug 2>$null | Out-Null
        }

        # Report result
        if ($testPassed) {
            if ($testMessage -match "WARN") {
                Add-Result -Addon $addon.Name -Check "SupervisorTest" -Status "WARN" -Message $testMessage
            }
            else {
                Add-Result -Addon $addon.Name -Check "SupervisorTest" -Status "PASS" -Message $testMessage
            }
        }
        else {
            Add-Result -Addon $addon.Name -Check "SupervisorTest" -Status "FAIL" -Message $testMessage
        }
    }
}
catch {
    Add-Result -Addon "System" -Check "SupervisorTest" -Status "FAIL" -Message "Unexpected error: $_"
}
finally {
    # Global cleanup
    Write-Host ""
    Write-Host "    > Cleaning up Supervisor environment..." -ForegroundColor Gray
    docker stop $containerName 2>$null | Out-Null
    docker rm -f $containerName 2>$null | Out-Null
    docker network rm $networkName 2>$null | Out-Null

    $dataDir = Join-Path $OutputDir "supervisor_test_data"
    if ($PSBoundParameters['Debug'] -or ($testPassed -eq $false)) {
        Write-Host "    > Preserving test data for debugging at: $dataDir" -ForegroundColor Yellow
    }
    elseif (Test-Path $dataDir) {
        Remove-Item $dataDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
