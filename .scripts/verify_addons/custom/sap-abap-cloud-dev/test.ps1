param(
    [Parameter(Mandatory)]$Addon,
    [Parameter(Mandatory)]$Config,
    [Parameter(Mandatory)]$OutputDir,
    [Parameter(Mandatory)]$RepoRoot,
    [Parameter(Mandatory)]$ContainerName
)

Write-Host "    > [Custom] Verifying SAP ABAP Cloud Dev..." -ForegroundColor Gray

# Get Docker Logs
$logs = docker logs "$ContainerName" 2>&1

# 1. Check for Standard Banner or SAP Startup logs
# Note: SAP takes a LONG time to start (5-15 mins). We verify early initialization.
if ($logs -match "FaserF's Addon Repository" -or $logs -match "SAP") {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "PASS" -Message "Banner/SAP log header found."
} else {
    Add-Result -Addon $Addon.Name -Check "BannerCheck" -Status "WARN" -Message "Standard banner/SAP header NOT found (start might be slow)."
}

# 2. Check for Process (HDB/sapstartsrv/java)
# We expect some heavy processes.
$procCheck = docker exec "$ContainerName" ps aux 2>&1
if ($procCheck -match "sapstartsrv" -or $procCheck -match "hdb.sap") {
     Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "PASS" -Message "SAP Service processes (sapstartsrv/hdb) detected."
} else {
     # It might be too early, check for at least s6-supervise
     if ($procCheck -match "s6-supervise") {
        Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "WARN" -Message "SAP processes not yet seen, but S6 supervisor is running."
     } else {
        Add-Result -Addon $Addon.Name -Check "ProcessCheck" -Status "FAIL" -Message "Critical processes NOT found."
     }
}

# 3. Port Check (8443 - Fiori)
# SAP startup is likely too slow for 8443 to be responsive in a short CI test, but we can try netstat if net-tools installed, or just basic connect check
try {
    $containerIp = docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $ContainerName 2>$null
    if ($containerIp) {
        # Quick check if port is open (TCP), not HTTP 200 as that takes forever
        $socket = New-Object System.Net.Sockets.TcpClient
        $connect = $socket.BeginConnect($containerIp, 8443, $null, $null)
        $success = $connect.AsyncWaitHandle.WaitOne(1000)
        if ($success) {
            Add-Result -Addon $Addon.Name -Check "PortCheck" -Status "PASS" -Message "Port 8443 is open."
             $socket.EndConnect($connect)
        } else {
            Add-Result -Addon $Addon.Name -Check "PortCheck" -Status "INFO" -Message "Port 8443 not yet open (startup ongoing, expected)."
        }
        $socket.Close()
    }
} catch {
     Add-Result -Addon $Addon.Name -Check "PortCheck" -Status "INFO" -Message "Port check skipped/failed (network or startup timing)."
}
