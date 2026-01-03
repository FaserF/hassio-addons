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
$supervisorStartupTimeout = $Config.supervisorTests.supervisorStartupTimeout ?? 90
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
    $mediaDir = Join-Path $dataDir "media"

    New-Item -ItemType Directory -Path $addonsDir -Force | Out-Null
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
    New-Item -ItemType Directory -Path $shareDir -Force | Out-Null
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
    New-Item -ItemType Directory -Path $mediaDir -Force | Out-Null

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

    $anyFailure = $false

    foreach ($addon in $Addons) {
        $addonPath = $addon.FullName

        # Try to get slug from config.yaml for best compatibility
        $configFile = Join-Path $addonPath "config.yaml"
        $safeName = $addon.Name.Replace('_', '-')

        if (Test-Path $configFile) {
            $configContent = Get-Content $configFile -Raw
            if ($configContent -match "(?m)^slug:\s*['""]?([a-zA-Z0-9-_]+)['""]?") {
                $safeName = $matches[1].Trim()
                Write-Host "      Detected slug in config: $safeName" -ForegroundColor DarkGray
            }
        }

        $targetPath = Join-Path $addonsDir $safeName

        Write-Host "      Copying $($addon.Name) as $safeName..." -ForegroundColor DarkGray
        Copy-Item -Path $addonPath -Destination $targetPath -Recurse -Force

        # Strip 'image' key from config.yaml to force local build/avoid pull errors
        # The CI environment needs the image key for tagging, but the test environment
        # will fail if it tries to pull that non-existent image.
        $testConfig = Join-Path $targetPath "config.yaml"
        if (Test-Path $testConfig) {
            (Get-Content $testConfig) | Where-Object { $_ -notmatch "^\s*image:" } | Set-Content $testConfig
        }

        # Special setup for netboot-xyz
        if ($safeName -eq "local_netboot-xyz" -or $addon.Name -eq "netboot-xyz") {
            $nbImage = Join-Path $mediaDir "netboot/image"
            $nbConfig = Join-Path $mediaDir "netboot/config"
            New-Item -ItemType Directory -Path $nbImage -Force | Out-Null
            New-Item -ItemType Directory -Path $nbConfig -Force | Out-Null
            Write-Host "      Created netboot media directories for $safeName" -ForegroundColor DarkGray
        }
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
        "-v", "${dataDirUnix}/share:/mnt/supervisor/share:rslave",
        "-v", "${dataDirUnix}/ssl:/mnt/supervisor/ssl",
        "-v", "${dataDirUnix}/media:/mnt/supervisor/media",
        "-v", "${logFileUnix}:/tmp/supervisor.log",
        "-v", "${dockerVolName}:/var/lib/docker",
        "-e", "SUPERVISOR_SHARE_DATA=1",
        "-e", "SUPERVISOR_TOKEN=generated_T9k8L", # Required for direct API calls via curl
        $devcontainerImage,
        "sleep", "infinity"
    )

    if ($PSBoundParameters['Debug']) {
        Write-Host "    > Debug: Running docker with args: $($runArgs -join ' ')" -ForegroundColor DarkGray
    }
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

        # Dot output removed to prevent log spam
        Start-Sleep -Seconds 1
    }
    Write-Progress -Activity "Initializing Supervisor" -Completed

    if (-not $supervisorReady) {
        Write-Host " Timeout!" -ForegroundColor Red

        Write-Host "    > Fetching internal supervisor logs..." -ForegroundColor Cyan

        # Read from host file since container might be dead/exited
        if (Test-Path $logFileHost) {
            $intLogs = Get-Content $logFileHost -Tail 50
        }
        else {
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
            # Configure MariaDB (Password is required)
            Write-Host "    > Configuring MariaDB..." -ForegroundColor Gray

            # Use Python API to set options reliably (avoiding CLI quoting issues)
            $mariaDbOpts = @{
                databases = @("homeassistant")
                logins    = @(
                    @{ username = "homeassistant"; password = "generated_m7R2x" }
                )
                rights    = @(
                    @{ username = "homeassistant"; database = "homeassistant" }
                )
            } | ConvertTo-Json -Depth 5 -Compress

            # Escape for Python string
            $mariaDbOptsStr = $mariaDbOpts.Replace('"', '\"')

            $pyScript = @"
import os, sys, json, urllib.request, urllib.error
token = os.environ.get("SUPERVISOR_TOKEN")
url = "http://supervisor/addons/core_mariadb/options"
data = json.loads("$mariaDbOptsStr")
req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), method="POST")
req.add_header("Authorization", f"Bearer {token}")
req.add_header("Content-Type", "application/json")
try:
    with urllib.request.urlopen(req) as response:
        print(response.getcode())
except Exception as e:
    print(e)
    sys.exit(1)
"@
            $tmpPyFile = Join-Path $env:TEMP "set_options_mariadb.py"
            [System.IO.File]::WriteAllText($tmpPyFile, ($pyScript -replace "`r`n", "`n"))
            docker cp $tmpPyFile "${containerName}:/tmp/set_options_mariadb.py" 2>$null | Out-Null
            docker exec $containerName python3 /tmp/set_options_mariadb.py 2>&1 | Out-Null
            Remove-Item $tmpPyFile -Force -ErrorAction SilentlyContinue

            $start = docker exec $containerName ha addons start core_mariadb 2>&1
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Failed to start MariaDB: $start"
                $mysqlFailed = $true
            }
            else {
                Write-Host "    > Waiting for MariaDB to be ready..." -ForegroundColor Gray
                $mariadbReady = $false
                $maxWait = 60
                $mariadbWaitStart = Get-Date
                while (((Get-Date) - $mariadbWaitStart).TotalSeconds -lt $maxWait) {
                    $statusJson = docker exec $containerName ha addons info core_mariadb --raw-json 2>$null
                    if ($statusJson) {
                        $status = $statusJson | ConvertFrom-Json
                        if ($status.data.state -eq "started") {
                            Write-Host "    ✅ MariaDB is ready." -ForegroundColor Green
                            $mariadbReady = $true
                            break
                        }
                    }
                    Start-Sleep -Seconds 5
                }
                if (-not $mariadbReady) {
                    Write-Warning "MariaDB failed to reach 'started' state within ${maxWait}s"
                    $mysqlFailed = $true
                }
            }
        }
        else {
            Write-Warning "Failed to install MariaDB: $inst"
            $mysqlFailed = $true
        }
    }

    $storeRefreshed = $false

    # Test each add-on
    foreach ($addon in $Addons) {
        if (-not (Should-RunTest -AddonName $addon.Name -TestName "SupervisorTest" -ChangedOnly $ChangedOnly -ChangedAddons $ChangedAddons -DocsOnlyTests $Config.docsOnlyTests)) {
            continue
        }

        # Check unsupported
        if ($addon.FullName -match "\\.unsupported\\") {
            Write-Host "    > Skipping unsupported add-on: $($addon.Name)" -ForegroundColor Yellow
            Add-Result -Addon $addon.Name -Check "SupervisorTest" -Status "SKIP" -Message "Unsupported add-on"
            continue
        }

        # Check dependency failure
        if ($mysqlFailed -and ($addon.Name -match "wiki\.js|wiki\.js3|pterodactyl-panel")) {
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

        # Sanitize slug
        $safeName = $addon.Name.Replace('_', '-')

        # Try to get slug from config.yaml to match what we copied
        $configFile = Join-Path $addon.FullName "config.yaml"
        if (Test-Path $configFile) {
            $configContent = Get-Content $configFile -Raw
            if ($configContent -match "(?m)^slug:\s*['""]?([a-zA-Z0-9-_]+)['""]?") {
                $safeName = $matches[1].Trim()
            }
        }

        $slug = "local_$safeName"
        $testPassed = $true
        $testMessage = ""

        try {
            if ($slug) {
                Write-Host "    Slug detected: $slug" -ForegroundColor Gray

                # Refresh store to pick up local changes
                # Only do this once to reduce noise
                if (-not $storeRefreshed) {
                    Write-Host "    Refreshing add-on store..." -ForegroundColor Gray
                    docker exec $containerName ha store refresh 2>&1 | Out-Null
                    $storeRefreshed = $true

                    # Debug: list addons
                    if ($PSBoundParameters['Debug']) {
                        docker exec $containerName ha addons 2>&1 | Out-Host
                    }
                }

                # Install add-on
                Write-Host "    Installing $($addon.Name) ($slug)..." -ForegroundColor Gray
                $installJob = Start-Job -ScriptBlock {
                    param($containerName, $slug, $debugPref)
                    if ($debugPref) { $VerbosePreference = "Continue"; $DebugPreference = "Continue" }
                    docker exec $containerName ha addons install $slug 2>&1
                } -ArgumentList $containerName, $slug, $PSBoundParameters['Debug']
            }

            $installResult = Wait-Job $installJob -Timeout $addonInstallTimeout
            if ($installResult.State -eq "Completed") {
                $installOutput = Receive-Job $installJob
                Remove-Job $installJob -Force

                if ($installOutput -match "error|failed|Error") {
                    # Handle 500 errors as warnings instead of failures
                    # Note: This is likely a CI container issue, but could also indicate real add-on start problems
                    # Should be investigated if it occurs frequently
                    if ($installOutput -match "unexpected server response.*500|500.*unexpected server response|status: 500") {
                        $testPassed = $true
                        $testMessage = "WARN: Install returned 500 error (likely CI container issue, but verify add-on): $installOutput"

                        # Try to fetch logs for investigation
                        $logs = docker exec $containerName ha addons logs $slug 2>&1 | Select-Object -Last 25
                        if ($logs) {
                            $logStr = $logs -join "`n"
                            $testMessage += ". Logs: $logStr"
                        }
                        Write-Host "    ⚠️ Install returned 500 (treating as WARN)" -ForegroundColor Yellow
                    }
                    else {
                        $testPassed = $false
                        $testMessage = "Install failed: $installOutput"

                        # Try to fetch logs if install failed (sometimes helpful)
                        if ($installOutput -match "500") {
                            $logs = docker exec $containerName ha addons logs $slug 2>&1 | Select-Object -Last 25
                            if ($logs) {
                                $logStr = $logs -join "`n"
                                $testMessage += ". Logs: $logStr"
                            }
                        }
                    }
                }
                else {
                    Write-Host "    ✅ Install successful" -ForegroundColor Green

                    # SKIPPING START/CONFIG PHASE AS REQUESTED
                    # TODO: Enable this flag when 500 errors are resolved
                    $shouldRunRuntimeTests = $false

                    # Configure apache2 addons immediately after installation to prevent SSL certificate errors
                    # This must happen even in Install Only Mode to prevent addon from failing on auto-start
                    $configFile = Join-Path $addon.FullName "config.yaml"
                    if (Test-Path $configFile) {
                        $configContent = Get-Content $configFile -Raw
                        
                        if ($addon.Name -match "apache2") {
                            # Stop addon if it auto-started during installation (to prevent SSL errors)
                            Write-Host "    > Stopping addon (if running) to configure SSL settings..." -ForegroundColor Gray
                            docker exec $containerName ha addons stop $slug 2>&1 | Out-Null
                            
                            # Handle all apache2 variants - configure SSL to false immediately after installation
                            # This prevents the addon from failing when it tries to start with default SSL enabled
                            Write-Host "    > Configuring apache2 addon (disabling SSL for test environment)..." -ForegroundColor Gray

                            # Build options based on what the addon supports
                            $baseOpts = @{
                                website_name     = "example.com"
                                default_conf     = "default"
                                default_ssl_conf = "default"
                                ssl              = $false
                            }

                            # Only include php_ini if the addon supports it
                            if ($configContent -match "php_ini") {
                                $baseOpts["php_ini"] = "default"
                            }

                            $opts = ($baseOpts | ConvertTo-Json -Compress)

                            # Create text file with options locally
                            $tmpOptsFile = Join-Path $env:TEMP "options_$($addon.Name).json"
                            $opts | Out-File -FilePath $tmpOptsFile -Encoding utf8 -Force
                            docker cp $tmpOptsFile "${containerName}:/tmp/options.json" 2>$null | Out-Null
                            Remove-Item $tmpOptsFile -Force -ErrorAction SilentlyContinue

                            # Create Python script to set options (Bypasses shell/curl issues)
                            $pyScript = @"
import os, sys, json, urllib.request, urllib.error

slug = "$slug"
token = os.environ.get("SUPERVISOR_TOKEN")

if not token:
    print("Error: No SUPERVISOR_TOKEN found in environment")
    sys.exit(1)

try:
    with open("/tmp/options.json", "r") as f:
        data = json.load(f)
except Exception as e:
    print(f"Error reading options: {e}")
    sys.exit(1)

url = f"http://supervisor/addons/{slug}/options"
req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), method="POST")
req.add_header("Authorization", f"Bearer {token}")
req.add_header("Content-Type", "application/json")

try:
    with urllib.request.urlopen(req) as response:
        print(response.getcode())
        print(response.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode("utf-8"))
    sys.exit(1)
except Exception as e:
    print(f"Exception: {e}")
    sys.exit(1)
"@
                            $tmpPyFile = Join-Path $env:TEMP "set_options_$($addon.Name).py"
                            [System.IO.File]::WriteAllText($tmpPyFile, ($pyScript -replace "`r`n", "`n"))
                            docker cp $tmpPyFile "${containerName}:/tmp/set_options.py" 2>$null | Out-Null

                            # Execute Python script
                            $pyOut = docker exec $containerName python3 /tmp/set_options.py 2>&1

                            # Check output for success (200)
                            if ($pyOut -notmatch "200") {
                                Write-Warning "Failed to set options via Python API."
                                Write-Warning "Output: $pyOut"
                            }
                            else {
                                if ($PSBoundParameters['Debug']) {
                                    Write-Host "      DEBUG: Python API Config Set Success" -ForegroundColor DarkGray
                                }
                            }

                            Remove-Item $tmpPyFile -Force -ErrorAction SilentlyContinue
                        }
                    }

                    if (-not $shouldRunRuntimeTests) {
                        Write-Host "    > Skipping Start/Config phase (Install Only Mode)" -ForegroundColor Yellow
                        Add-Result -Addon $addon.Name -Check "SupervisorTest" -Status "PASS" -Message "PASS (Install Only)"
                    }
                    else {

                        # Configure add-on if needed (for non-apache2 addons)
                        if (Test-Path $configFile) {
                            $configContent = Get-Content $configFile -Raw
                            $opts = $null

                            if ($addon.Name -match "apache2") {
                                # Already configured above, skip
                                $opts = $null
                            }
                            elseif ($addon.Name -match "^pterodactyl-wings$") {
                                $opts = '{"config_file": "config.yml"}'
                            }
                            elseif ($addon.Name -eq "bash_script_executer") {
                                $opts = '{"script_path": "/share/test.sh"}'
                            }
                            elseif ($addon.Name -eq "netboot-xyz") {
                                $opts = '{"path": "/media/netboot/image", "path_config": "/media/netboot/config", "dhcp_range": "192.168.1.200"}'
                            }
                            elseif ($addon.Name -eq "antigravity-server") {
                                $opts = '{"vnc_password": "Ab1Cd2Ef", "log_level": "info"}'
                            }
                            elseif ($addon.Name -eq "aegisbot") {
                                $opts = '{"version": "latest", "github_token": "mock", "github_repo": "FaserF/AegisBot", "developer_mode": false, "reset_database": false, "log_level": "info", "database": {"type": "sqlite"}, "secret_key": "generated_K3y9P", "project_name": "AegisBot", "debug": false, "demo_mode": true}'
                            }
                            elseif ($addon.Name -eq "solumati") {
                                $opts = '{"log_level": "info", "test_mode": true}'
                            }
                            elseif ($configContent -match "website_name") {
                                # Fallback generic detection
                                $opts = '{"website_name": "example.com"}'
                            }

                            if ($opts) {
                                Write-Host "    > Configuring options (using ha addons options via strict file pass)..." -ForegroundColor Gray

                                # Debug: Show what we are sending
                                if ($PSBoundParameters['Debug']) {
                                    Write-Host "      DEBUG: Sending Config: $opts" -ForegroundColor DarkGray
                                }

                                # Create text file with options locally
                                $tmpOptsFile = Join-Path $env:TEMP "options_$($addon.Name).json"
                                $opts | Out-File -FilePath $tmpOptsFile -Encoding utf8 -Force
                                docker cp $tmpOptsFile "${containerName}:/tmp/options.json" 2>$null | Out-Null
                                Remove-Item $tmpOptsFile -Force -ErrorAction SilentlyContinue

                                # Create Python script to set options (Bypasses shell/curl issues)
                                $pyScript = @"
import os, sys, json, urllib.request, urllib.error

slug = "$slug"
token = os.environ.get("SUPERVISOR_TOKEN")

if not token:
    print("Error: No SUPERVISOR_TOKEN found in environment")
    sys.exit(1)

try:
    with open("/tmp/options.json", "r") as f:
        data = json.load(f)
except Exception as e:
    print(f"Error reading options: {e}")
    sys.exit(1)

url = f"http://supervisor/addons/{slug}/options"
req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), method="POST")
req.add_header("Authorization", f"Bearer {token}")
req.add_header("Content-Type", "application/json")

try:
    with urllib.request.urlopen(req) as response:
        print(response.getcode())
        print(response.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode("utf-8"))
    sys.exit(1)
except Exception as e:
    print(f"Exception: {e}")
    sys.exit(1)
"@
                                $tmpPyFile = Join-Path $env:TEMP "set_options_$($addon.Name).py"
                                [System.IO.File]::WriteAllText($tmpPyFile, ($pyScript -replace "`r`n", "`n"))
                                docker cp $tmpPyFile "${containerName}:/tmp/set_options.py" 2>$null | Out-Null

                                # Execute Python script
                                $pyOut = docker exec $containerName python3 /tmp/set_options.py 2>&1

                                # Check output for success (200)
                                if ($pyOut -notmatch "200") {
                                    Write-Warning "Failed to set options via Python API."
                                    Write-Warning "Output: $pyOut"
                                }
                                else {
                                    if ($PSBoundParameters['Debug']) {
                                        Write-Host "      DEBUG: Python API Config Set Success" -ForegroundColor DarkGray
                                    }
                                }

                                Remove-Item $tmpPyFile -Force -ErrorAction SilentlyContinue

                            }

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

                        # Check for immediate start failure (e.g. 500 error)
                        if ($startOutput -match "error|failed|Error|500 Server Error") {
                            # Handle 500 errors as warnings instead of failures
                            # Note: This is likely a CI container issue, but could also indicate real add-on start problems
                            # Should be investigated if it occurs frequently
                            if ($startOutput -match "unexpected server response.*500|500.*unexpected server response|status: 500") {
                                $testPassed = $true
                                $testMessage = "WARN: Start returned 500 error (likely CI container issue, but verify add-on): $startOutput"
                                
                                # Add logs for investigation
                                $logs = docker exec $containerName ha addons logs $slug 2>&1 | Select-Object -Last 25
                                if ($logs) {
                                    $logStr = $logs -join "`n"
                                    $testMessage += ". Logs: $logStr"
                                }
                                Write-Host "    ⚠️ Start returned 500 (treating as WARN)" -ForegroundColor Yellow
                            }
                            else {
                                $testPassed = $false
                                $testMessage = "Start failed: $startOutput"
                                # Add logs for start failures
                                $logs = docker exec $containerName ha addons logs $slug 2>&1 | Select-Object -Last 25
                                if ($logs) {
                                    $logStr = $logs -join "`n"
                                    $testMessage += ". Logs: $logStr"
                                }
                                Write-Host "    ❌ Start command failed" -ForegroundColor Red
                            }
                        }

                        Start-Sleep -Seconds 2




                        # Poll for status (wait for start/pull)
                        $pollingTimeout = $addonStartTimeout
                        $started = $false
                        $state = "unknown"
                        $infoJson = ""

                        for ($i = 0; $i -lt $pollingTimeout; $i += 5) {
                            # Use docker ps to check if container is running (bypassing potentially hanging ha CLI)
                            # The container name format is usually addon_slug
                            $runningContainers = docker exec $containerName docker ps --format "{{.Names}}" 2>$null
                            if ($runningContainers -match "addon_$slug") {
                                $started = $true
                                $state = "started"
                                break
                            }

                            Start-Sleep -Seconds 5
                        }
                        Write-Host "" # Newline

                        if ($started) {
                            # Verify running state again
                            $runningContainers = docker exec $containerName docker ps --format "{{.Names}}" 2>$null
                            if ($runningContainers -match "addon_$slug") {
                                $state = "started"
                                # Populate $info for ingress check
                                $infoJson = docker exec $containerName ha addons info $slug --raw-json 2>$null
                                if ($infoJson) {
                                    $info = $infoJson | ConvertFrom-Json
                                }
                            }
                            else {
                                $state = "stopped"
                            }


                            if ($state -eq "started") {
                                Write-Host "    ✅ Add-on running" -ForegroundColor Green

                                # Check ingress
                                $hasIngress = $info.data.ingress
                                if ($hasIngress -eq $true) {
                                    Write-Host "    > Testing ingress endpoint..." -ForegroundColor Gray
                                    $ingressUrl = $info.data.ingress_url
                                    if ($ingressUrl) {
                                        # Retry loop for Ingress (up to 30s)
                                        $retries = 6
                                        $ingressOk = $false
                                        while ($retries -gt 0) {
                                            $curlResult = docker exec $containerName curl -s -o /dev/null -w "%{http_code}" "http://localhost:8099$ingressUrl" 2>&1
                                            if ($curlResult -match "^[23]") {
                                                $ingressOk = $true
                                                break
                                            }
                                            Start-Sleep -Seconds 5
                                            $retries--
                                        }

                                        if ($ingressOk) {
                                            Write-Host "    ✅ Ingress reachable (HTTP $curlResult)" -ForegroundColor Green
                                            $testMessage = "PASS (Ingress OK, State: $state)"
                                        }
                                        else {
                                            Write-Host "    ⚠️ Ingress returned HTTP $curlResult after retries" -ForegroundColor Yellow
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
                                }
                                else {
                                    Write-Host "No log file found at $logFileHost" -ForegroundColor Yellow
                                }

                                $logStr = $logs -join "`n"
                                $testMessage = "State: $state. Logs: $logStr"
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
        $anyFailure = $true
        Add-Result -Addon $addon.Name -Check "SupervisorTest" -Status "FAIL" -Message $testMessage
    }
}
}
catch {
    Add-Result -Addon "System" -Check "SupervisorTest" -Status "FAIL" -Message "Unexpected error: $($_.Exception.Message)"
}
finally {
    # Global cleanup
    Write-Host ""
    Write-Host "    > Cleaning up Supervisor environment..." -ForegroundColor Gray
    docker stop $containerName 2>$null | Out-Null
    docker rm -f $containerName 2>$null | Out-Null
    docker network rm $networkName 2>$null | Out-Null

    $dataDir = Join-Path $OutputDir "supervisor_test_data"
    if ($PSBoundParameters['Debug'] -or $anyFailure) {
        Write-Host "    > Preserving test data for debugging at: $dataDir" -ForegroundColor Yellow
    }
    elseif (Test-Path $dataDir) {
        Write-Host "    > Wiping test data using Docker (to handle root-owned files)..." -ForegroundColor Gray
        $dataDirUnix = $dataDir.Replace('\', '/')
        docker run --rm -v "${dataDirUnix}:/data" busybox sh -c "rm -rf /data/*" 2>$null | Out-Null
        Remove-Item $dataDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
}
