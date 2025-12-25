<#
.SYNOPSIS
    Runs local CI/CD verification for Home Assistant Add-ons V2.1.

.DESCRIPTION
    Comprehensive verification suite:
    1. LF Line Ending Check & Fix
    2. ShellCheck
    3. Hadolint (Docker)
    4. YamlLint
    5. MarkdownLint
    6. Prettier
    7. Add-on Linter (Docker)
    8. Compliance (Python)
    9. Trivy (Docker)
    10. Dynamic Version Check (Renovate-managed)
    11. Docker Test (Build/Run with Dynamic Base)

.PARAMETER Addon
    Specific add-on to check. Defaults to "all".

.PARAMETER Tests
    List of tests to run (e.g., "all", "DockerBuild", "ShellCheck").
    Defaults to "all".

.PARAMETER IncludeUnsupported
    If switch is present, also checks add-ons in .unsupported folder when running "all".

.PARAMETER Fix
    Attempts to fix common issues (Prettier, Line Endings, Configs).
#>

param(
    [string[]]$Addon = @("all"),
    [string[]]$Tests = @("all"),
    [switch]$IncludeUnsupported,
    [switch]$Fix
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path "$PSScriptRoot\.."
$env:PYTHONIOENCODING = "utf-8"

# --- RENOVATE-MANAGED VARIABLES ---
# renovate: datasource=docker depName=ghcr.io/hassio-addons/base
$LatestBase = if ($env:LATEST_BASE) { $env:LATEST_BASE } else { "19.0.0" }
# renovate: datasource=docker depName=ghcr.io/hassio-addons/debian-base
$LatestDebian = if ($env:LATEST_DEBIAN) { $env:LATEST_DEBIAN } else { "9.1.0" }
# renovate: datasource=docker depName=ghcr.io/home-assistant/amd64-base-python
$LatestPython = if ($env:LATEST_PYTHON) { $env:LATEST_PYTHON } else { "3.13-alpine3.21" }
# renovate: datasource=node-version depName=node
$LatestNode = if ($env:LATEST_NODE) { $env:LATEST_NODE } else { "24.12.0" }

# Data structures for Summary
$Results = @()

function Add-Result {
    param($Addon, $Check, $Status, $Message)
    $obj = [PSCustomObject]@{
        Addon   = $Addon
        Check   = $Check
        Status  = $Status
        Message = $Message
    }
    $script:Results += $obj
    if ($Status -eq "FAIL") {
        Write-Host "FAIL: [$Addon] $Check - $Message" -ForegroundColor Red
        $script:GlobalFailed = $true
    }
    elseif ($Status -eq "WARN") {
        Write-Host "WARN: [$Addon] $Check - $Message" -ForegroundColor Yellow
    }
    elseif ($Status -eq "INFO") {
        Write-Host "INFO: [$Addon] $Check - $Message" -ForegroundColor Cyan
    }
    else {
        Write-Host "MATCH: [$Addon] $Check" -ForegroundColor Green
    }
}

function Write-Header {
    param($Message)
    Write-Host "`n================================================================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "================================================================================"
}

function Check-Docker {
    Write-Host "Checking Docker..." -ForegroundColor Gray
    $dockerInfo = docker info 2>&1
    if ($LASTEXITCODE -eq 0 -and $dockerInfo -match "Server Version") { return $true }

    if (Get-Process "Docker Desktop" -ErrorAction SilentlyContinue) {
        Write-Host "Docker Desktop running but not responsive..." -ForegroundColor Gray
    }
    else {
        $dockerExe = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
        if (Test-Path $dockerExe) {
            Write-Host "Starting Docker Desktop..." -ForegroundColor Gray
            Start-Process $dockerExe
            for ($i = 0; $i -lt 60; $i++) {
                Start-Sleep -Seconds 2
                $info = docker info 2>&1
                if ($LASTEXITCODE -eq 0 -and $info -match "Server Version") { return $true }
                Write-Host -NoNewline "."
            }
        }
    }
    return $false
}

function Get-BuildFrom {
    param($Path)
    # Extracts amd64 base image from build.yaml using Python (Safe Arg Parsing)
    $script = "import sys, yaml; print(yaml.safe_load(open(sys.argv[1]))['build_from'].get('amd64', ''))"
    try {
        $pathArg = $Path.Replace('\','/')
        $res = python -c $script $pathArg 2>&1
        if ($LASTEXITCODE -eq 0) { return $res.Trim() }
        return $null
    }
    catch { return $null }
}

function Get-DefaultOptions {
    param($Path)
    # Extracts 'options' key from config.yaml as JSON
    $script = "import sys, yaml, json; print(json.dumps(yaml.safe_load(open(sys.argv[1])).get('options', {})))"
    try {
        $pathArg = $Path.Replace('\','/')
        $json = python -c $script $pathArg 2>&1
        if ($LASTEXITCODE -eq 0) { return $json }
        return "{}"
    }
    catch { return "{}" }
}

Set-Location $RepoRoot
$GlobalFailed = $false

# --- CHECK DOCKER AVAILABILITY ---
# Check Docker upfront if any Docker-related tests are selected
$DockerTests = @("Hadolint", "AddonLinter", "Trivy", "DockerBuild")
$DockerAvailable = $false
if ("all" -in $Tests -or ($Tests | Where-Object { $_ -in $DockerTests })) {
    $DockerAvailable = Check-Docker
    if (-not $DockerAvailable) {
        Write-Host "WARNING: Docker is not available. Docker-related tests will be skipped." -ForegroundColor Yellow
    }
}

# --- SCOPE DEFINITION ---
# Handle both single string and array input for -Addon parameter
if ($Addon.Count -eq 1 -and $Addon[0] -eq "all") {
    $addons = Get-ChildItem -Path . -Directory | Where-Object {
        (Test-Path "$($_.FullName)\config.yaml") -and ($_.Name -ne ".git") -and ($_.Name -ne ".unsupported") -and ($_.Name -ne "homeassistant-test-instance")
    }
    if ($IncludeUnsupported) {
        $unsup = Get-ChildItem -Path .unsupported -Directory -ErrorAction SilentlyContinue
        if ($unsup) { $addons += $unsup }
    }
}
else {
    $addons = @()
    foreach ($addonName in $Addon) {
        # Check root
        if (Test-Path $addonName) {
            $addons += Get-Item $addonName
        }
        elseif (Test-Path ".unsupported\$addonName") {
            $addons += Get-Item ".unsupported\$addonName"
        }
        else {
            Write-Host "WARNING: Add-on '$addonName' not found, skipping." -ForegroundColor Yellow
        }
    }
    if ($addons.Count -eq 0) {
        Throw "No valid add-ons found from the provided list."
    }
}

# --- AUTO FIX ---
if ($Fix) {
    Write-Header "0. Auto-Fix Mode"
    Write-Host "Running Fixers..." -ForegroundColor Gray
    if (Test-Path ".scripts/fix_line_endings.py") { python .scripts/fix_line_endings.py }
    if (Test-Path ".scripts/fix_configs.py") { python .scripts/fix_configs.py }
    try { npx prettier --write "**/*.{json,js,md,yaml}" --ignore-path .prettierignore } catch {}
    try { npx markdownlint-cli "**/*.md" --config .markdownlint.yaml --fix --ignore "node_modules" --ignore ".git" } catch {}
}

# --- 1. LF CHECK ---
if ("all" -in $Tests -or "LineEndings" -in $Tests) {
    Write-Header "1. Line Ending Check"
    foreach ($a in $addons) {
        $files = Get-ChildItem $a.FullName -Recurse -Include "*.sh", "*.md", "*.yaml"
        $crlfFound = $false
        foreach ($f in $files) {
            $content = [IO.File]::ReadAllText($f.FullName)
            if ($content.Contains("`r`n")) {
                $crlfFound = $true
                if ($Fix) {
                    $content = $content -replace "`r`n", "`n"
                    [IO.File]::WriteAllText($f.FullName, $content)
                    Add-Result $a.Name "LineEndings" "PASS" "Fixed $($f.Name)"
                    $crlfFound = $false
                }
                else {
                    Add-Result $a.Name "LineEndings" "FAIL" "CRLF in $($f.Name)"
                    break
                }
            }
        }
        if (-not $crlfFound) { Add-Result $a.Name "LineEndings" "PASS" "OK" }
    }
}

# --- 2. SHELLCHECK ---
if ("all" -in $Tests -or "ShellCheck" -in $Tests) {
    Write-Header "2. ShellCheck"
    $shellcheck = ".\shellcheck.exe"
    foreach ($a in $addons) {
        $sh = Get-ChildItem $a.FullName -Recurse -Filter "*.sh"
        $failed = $false
        foreach ($s in $sh) {
            if (-not (Test-Path $shellcheck)) {
                Add-Result $a.Name "ShellCheck" "WARN" "Binary missing"
                $failed = $true
                break
            }
            try {
                & $shellcheck -s bash -e SC2086 $s.FullName
                if ($LASTEXITCODE -ne 0) { throw "Fail" }
            }
            catch {
                Add-Result $a.Name "ShellCheck" "FAIL" "$($s.Name) failed"
                $failed = $true
            }
        }
        if (-not $failed) { Add-Result $a.Name "ShellCheck" "PASS" "OK" }
    }
}

# --- 3. HADOLINT ---
if ("all" -in $Tests -or "Hadolint" -in $Tests) {
    Write-Header "3. Hadolint"
    if ($DockerAvailable) {
        foreach ($a in $addons) {
            $df = Join-Path $a.FullName "Dockerfile"
            if (Test-Path $df) {
                try {
                    $out = (Get-Content $df | docker run --rm -i hadolint/hadolint hadolint - 2>&1)
                    # Parse Hadolint Output manually to avoid failing on non-errors if any
                    if ($out -match "DL\d+" -or $out -match "SC\d+") { Add-Result $a.Name "Hadolint" "FAIL" $out }
                    else { Add-Result $a.Name "Hadolint" "PASS" "OK" }
                }
                catch { Add-Result $a.Name "Hadolint" "FAIL" "Exec Error" }
            }
        }
    }
    else { Add-Result "Global" "Hadolint" "WARN" "Docker unavailable" }
}

# --- 4. YAMLLINT ---
if ("all" -in $Tests -or "YamlLint" -in $Tests) {
    Write-Header "4. YamlLint"
    try {
        python -m yamllint .
        if ($LASTEXITCODE -ne 0) { throw "Fail" }
        Add-Result "All" "YamlLint" "PASS" "OK"
    }
    catch {
        Add-Result "All" "YamlLint" "FAIL" "Errors found"
    }
}

# --- 5. MARKDOWNLINT ---
# --- 5. MARKDOWNLINT ---
if ("all" -in $Tests -or "MarkdownLint" -in $Tests) {
    Write-Header "5. MarkdownLint"
    foreach ($a in $addons) {
        try {
            $target = "**/*.md"
            if ($Addon.Count -ne 1 -or $Addon[0] -ne "all") {
               $target = "$($a.FullName)\**\*.md"
            }
            # Only run if files exist to avoid error
            if (Get-ChildItem -Path $a.FullName -Recurse -Filter "*.md") {
                npx markdownlint-cli $target --config .markdownlint.yaml --ignore "node_modules" --ignore ".git" --ignore ".unsupported"
                if ($LASTEXITCODE -ne 0) { throw "Fail" }
                Add-Result $a.Name "MarkdownLint" "PASS" "OK"
            }
        }
        catch {
            Add-Result $a.Name "MarkdownLint" "FAIL" "Errors found (See log)"
        }
    }
}

# --- 6. PRETTIER ---
# --- 6. PRETTIER ---
if ("all" -in $Tests -or "Prettier" -in $Tests) {
    Write-Header "6. Prettier"
    foreach ($a in $addons) {
        try {
            $ptarget = "**/*.{json,js,md,yaml}"
            if ($Addon.Count -ne 1 -or $Addon[0] -ne "all") {
                $ptarget = "$($a.FullName)\**\*.{json,js,md,yaml}"
            }
            npx prettier --check $ptarget --ignore-path .prettierignore
            if ($LASTEXITCODE -ne 0) { throw "Fail" }
            Add-Result $a.Name "Prettier" "PASS" "OK"
        }
        catch {
             Add-Result $a.Name "Prettier" "FAIL" "Formatting issues"
        }
    }
}

# --- 7. ADD-ON LINTER ---
if ("all" -in $Tests -or "AddonLinter" -in $Tests) {
    Write-Header "7. Add-on Linter"
    if ($DockerAvailable) {
        $img = "ghcr.io/frenck/action-addon-linter:v2"
        if ((docker pull $img 2>&1) -match "denied") {
            Add-Result "Global" "AddonLinter" "WARN" "Image pull failed (Auth needed). Skipping."
        }
        else {
            foreach ($a in $addons) {
                try {
                    $res = docker run --rm -v "$($a.FullName):/data" --entrypoint addon-linter $img --path /data 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        Add-Result $a.Name "AddonLinter" "PASS" "OK"
                    }
                    elseif ($a.Name -eq "netboot-xyz" -and $res -match "full_access") {
                        # netboot-xyz requires full access for network boot services
                        Add-Result $a.Name "AddonLinter" "WARN" "Allowed 'full_access' (User Required)"
                    }
                    else {
                        Add-Result $a.Name "AddonLinter" "FAIL" $res
                    }
                }
                catch { Add-Result $a.Name "AddonLinter" "FAIL" "Exec Error" }
            }
        }
    }
}

# --- 8. COMPLIANCE ---
if ("all" -in $Tests -or "Compliance" -in $Tests) {
    Write-Header "8. Compliance"
    foreach ($a in $addons) {
        try {
            $out = python .scripts/check_compliance.py $a.FullName 2>&1
            if ($LASTEXITCODE -eq 0) { Add-Result $a.Name "Compliance" "PASS" "OK" }
            else {
                Add-Result $a.Name "Compliance" "FAIL" "See details below"
                Write-Host "`n--- COMPLIANCE REPORT FOR $($a.Name) ---" -ForegroundColor Red
                Write-Host $out -ForegroundColor Gray
                Write-Host "----------------------------------------`n" -ForegroundColor Red
            }
        }
        catch { Add-Result $a.Name "Compliance" "FAIL" "Script Error" }
    }
}

# --- 9. TRIVY ---
if ("all" -in $Tests -or "Trivy" -in $Tests) {
    Write-Header "9. Trivy"
    if ($DockerAvailable) {
        $trivy = "aquasec/trivy:latest"
        docker volume create trivy_cache >$null

        if ((docker pull $trivy 2>&1) -match "denied") {
            Add-Result "Global" "Trivy" "WARN" "Skipping Trivy due to pull failure."
        }
        else {
            foreach ($a in $addons) {
                $relPath = $a.FullName.Substring("$RepoRoot".Length).TrimStart('\', '/').Replace('\', '/')
                $res = docker run --rm -v "trivy_cache:/root/.cache/trivy" -v "$($RepoRoot):/app" $trivy fs "/app/$relPath" --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1 2>&1
                if ($LASTEXITCODE -ne 0) {
                    Add-Result $a.Name "Trivy" "WARN" "Vulnerabilities Found (See log)"
                }
                else {
                    Add-Result $a.Name "Trivy" "PASS" "OK"
                }
            }
        }
    }
}

# --- 10. VERSION CHECK (Dynamic & Broad) ---
if ("all" -in $Tests -or "VersionCheck" -in $Tests) {
    Write-Header "10. Base Image & Version Check"
    foreach ($a in $addons) {
        $buildFile = Join-Path $a.FullName "build.yaml"
        if (Test-Path $buildFile) {
            $base = Get-BuildFrom $buildFile
            $baseImage = $base
            if ($baseImage) {
                # Check against known latest versions
                if ($baseImage -match "ghcr\.io/hassio-addons/base:([\d\.]+)") {
                    $ver = $matches[1]
                    if ($ver -ne $LatestBase) { Add-Result $a.Name "Ver-Base" "WARN" "Uses Base $ver (Latest: $LatestBase)" }
                    else { Add-Result $a.Name "Ver-Base" "PASS" "OK ($ver)" }
                }
                elseif ($baseImage -match "ghcr\.io/hassio-addons/debian-base:([\d\.]+)") {
                    $ver = $matches[1]
                    if ($ver -ne $LatestDebian) { Add-Result $a.Name "Ver-Debian" "WARN" "Uses Debian $ver (Latest: $LatestDebian)" }
                    else { Add-Result $a.Name "Ver-Debian" "PASS" "OK ($ver)" }
                }
                elseif ($baseImage -match "ghcr\.io/home-assistant/amd64-base-python:([\w\.]+)") {
                    $ver = $matches[1]
                    if ($ver -ne $LatestPython) { Add-Result $a.Name "Ver-Python" "WARN" "Uses Python $ver (Latest: $LatestPython)" }
                    else { Add-Result $a.Name "Ver-Python" "PASS" "OK ($ver)" }
                }
                else {
                    Add-Result $a.Name "Ver-Base" "INFO" "Unmonitored Base: $baseImage"
                }
            }
        }

        # Check Node Version
        $df = Join-Path $a.FullName "Dockerfile"
        if (Test-Path $df) {
            $content = Get-Content $df -Raw
            if ($content -match 'ARG NODE_VERSION=["'']?([\d\.]+)["'']?') {
                $ver = $matches[1]
                if ($ver -ne $LatestNode) {
                    Add-Result $a.Name "Ver-Node" "WARN" "Uses Node $ver (Latest: $LatestNode)"
                }
                else {
                    Add-Result $a.Name "Ver-Node" "PASS" "OK ($ver)"
                }
            }
        }
    }
}

# --- 11. DOCKER TEST (Dynamic Build) ---
if ("all" -in $Tests -or "DockerBuild" -in $Tests) {
    if ($DockerAvailable) {
        Write-Header "11. Docker Test (Dynamic Build)"
        foreach ($a in $addons) {
            $imgName = "local/test-$($a.Name.ToLower())"
            $date = Get-Date -Format "yyyy-MM-dd"

            # Get the correct base image for this addon
            $buildFile = Join-Path $a.FullName "build.yaml"
            $addonBase = $null
            if (Test-Path $buildFile) {
                $addonBase = Get-BuildFrom $buildFile
            }

            # Build
            $buildArgs = @("build", "--build-arg", "BUILD_DATE=$date")
            if ($addonBase) {
                 $buildArgs += "--build-arg"
                 $buildArgs += "BUILD_FROM=$addonBase"
            } else {
                 $buildArgs += "--build-arg"
                 $buildArgs += "BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest"
            }
            $buildArgs += "-t"
            $buildArgs += $imgName
            $buildArgs += $a.FullName

            $buildOutput = & docker $buildArgs 2>&1
            $buildSuccess = ($LASTEXITCODE -eq 0)

            if (-not $buildSuccess) {
                Add-Result $a.Name "DockerBuild" "FAIL" "Build Failed. Output:`n$buildOutput"
            }
            else {
                Add-Result $a.Name "DockerBuild" "PASS" "OK"

                # --- ENHANCED RUN TEST ---
                $contName = "test-run-$($a.Name.ToLower())"
                docker rm -f $contName 2>$null | Out-Null

                # prepare config
                $tempDir = Join-Path $env:TEMP "ha-addon-test-$($a.Name)"
                if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
                New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

                $configFile = Join-Path $a.FullName "config.yaml"
                if (Test-Path $configFile) {
                    $jsonOpts = Get-DefaultOptions $configFile
                    $jsonOpts | Out-File -FilePath (Join-Path $tempDir "options.json") -Encoding UTF8
                } else {
                    "{}" | Out-File -FilePath (Join-Path $tempDir "options.json") -Encoding UTF8
                }

                # Run with HA-like env
                # We simulate a "data" mount and provide options.json
                $runArgs = @("run", "-d", "--name", $contName)
                $runArgs += "-v", "$tempDir`:/data"
                $runArgs += "-e", "HASSIO_TOKEN=testing_token"
                $runArgs += "-e", "BASHIO_SUPERVISOR_API=http://localhost"
                $runArgs += $imgName

                $runInfo = & docker $runArgs 2>&1

                # Extended wait for healthcheck/startup
                Write-Host "    > Waiting 20s for startup verification..." -ForegroundColor Gray
                Start-Sleep -Seconds 20

                $inspectJson = docker inspect $contName | ConvertFrom-Json
                $isRunning = ($inspectJson.State.Running -eq $true)
                $healthStatus = if ($inspectJson.State.Health) { $inspectJson.State.Health.Status } else { "none" }

                # Check logs for fatal errors
                $logs = docker logs $contName 2>&1
                $logError = $false
                if ($logs -match "panic:" -or $logs -match "s6-rc: fatal") {
                    $logError = $true
                }

                if (-not $isRunning) {
                     Add-Result $a.Name "DockerRun" "FAIL" "Crashed immediately. Logs summary:`n$($logs | Select-Object -Last 10)"
                }
                elseif ($healthStatus -eq "unhealthy") {
                     Add-Result $a.Name "DockerRun" "FAIL" "Container marked UNHEALTHY."
                }
                elseif ($logError) {
                     Add-Result $a.Name "DockerRun" "FAIL" "Fatal error in logs detected."
                }
                else {
                     Add-Result $a.Name "DockerRun" "PASS" "Stable (Running, Health: $healthStatus)"
                }

                # Cleanup
                docker rm -f $contName 2>$null | Out-Null
                Remove-Item $tempDir -Recurse -Force 2>$null
            }
        }
    }
}

# --- SUMMARY ---
Write-Header "EXECUTION SUMMARY"
$Results | Format-Table -AutoSize

if ($GlobalFailed) { exit 1 } else { exit 0 }
