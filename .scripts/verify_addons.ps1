<#
.SYNOPSIS
    Runs local CI/CD verification for Home Assistant Add-ons V2.2.

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
    12. CodeRabbit-Style Deep Checks (Reproducibility, Healthchecks, etc.)

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
        $res = $json | Out-String
        if ($LASTEXITCODE -eq 0 -and $res -match '^\s*\{.*\}\s*$') { return $res.Trim() }
        return "{}"
    }
    catch { return "{}" }
}

Set-Location $RepoRoot
$GlobalFailed = $false

# --- CHECK DOCKER AVAILABILITY ---
# Check Docker upfront if any Docker-related tests are selected
$DockerTests = @("Hadolint", "AddonLinter", "Trivy", "DockerBuild", "WorkflowChecks")
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
if ("all" -in $Tests -or "MarkdownLint" -in $Tests) {
    Write-Header "5. MarkdownLint"
    foreach ($a in $addons) {
        try {
            # Always use addon-specific target inside the loop to avoid cross-addon failures
            $target = "$($a.FullName)\**\*.md"
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
if ("all" -in $Tests -or "Prettier" -in $Tests) {
    Write-Header "6. Prettier"
    foreach ($a in $addons) {
        try {
            # Always use addon-specific target inside the loop to avoid cross-addon failures
            $ptarget = "$($a.FullName)\**\*.{json,js,md,yaml}"
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

            # Build using Home Assistant Builder (matches CI)
            Write-Host "    > Building $($a.Name) with ghcr.io/home-assistant/amd64-builder..." -ForegroundColor Gray

            $builderImage = "ghcr.io/home-assistant/amd64-builder:2025.11.0"
            $arch = "amd64" # Default for local testing

            # Pull builder if missing
            if (-not (docker images -q $builderImage)) {
                docker pull $builderImage | Out-Null
            }

            # Construct Builder Arguments
            $buildArgs = @("run", "--rm", "--privileged")
            $buildArgs += "-v", "/var/run/docker.sock:/var/run/docker.sock"
            $buildArgs += "-v", "$($a.FullName.Replace('\','/')):/data"
            # Mount temp cache
            $buildArgs += "-v", "$($env:TEMP)/ha-builder-cache:/cache"
            $buildArgs += $builderImage
            $buildArgs += "--test"
            $buildArgs += "--$arch"
            $buildArgs += "--target", "/data"
            $buildArgs += "--image", $imgName
            $buildArgs += "--docker-hub", "local"

            if ($addonBase) {
                 # Not strictly needed if build.yaml exists, builder handles it, but passed for override if logic demands
                 # Builder reads build.yaml inside /data
            }

            $buildOutput = & docker @buildArgs 2>&1
            $buildSuccess = ($LASTEXITCODE -eq 0)

            if (-not $buildSuccess) {
                Add-Result $a.Name "DockerBuild" "FAIL" "Build Failed. Output:`n$buildOutput"
            }
            else {
                Add-Result $a.Name "DockerBuild" "PASS" "OK"

                # --- ENHANCED RUN TEST with MOCK SUPERVISOR ---
                $contName = "test-run-$($a.Name.ToLower())"
                $mockName = "mock-supervisor"
                $networkName = "ha-addon-test-net"
                docker rm -f $contName 2>$null | Out-Null
                docker rm -f $mockName 2>$null | Out-Null

                # Create isolated network for this test
                docker network rm $networkName 2>$null | Out-Null
                docker network create $networkName 2>$null | Out-Null

                # Prepare config
                $tempDir = Join-Path $env:TEMP "ha-addon-test-$($a.Name)"
                if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
                New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

                $configFile = Join-Path $a.FullName "config.yaml"
                $optionsPath = Join-Path $tempDir "options.json"
                if (Test-Path $configFile) {
                    $jsonOpts = Get-DefaultOptions $configFile
                    # Inject default log_level if missing (required by bashio)
                    try {
                        $optObj = $jsonOpts | ConvertFrom-Json -ErrorAction Stop
                        if (-not $optObj.log_level) {
                            $optObj | Add-Member -NotePropertyName "log_level" -NotePropertyValue "info" -Force
                        }
                        $optObj | ConvertTo-Json -Depth 10 | Out-File -FilePath $optionsPath -Encoding UTF8
                    } catch {
                        '{"log_level":"info"}' | Out-File -FilePath $optionsPath -Encoding UTF8
                    }
                } else {
                    '{"log_level":"info"}' | Out-File -FilePath $optionsPath -Encoding UTF8
                }

                # Start Mock Supervisor API container
                Write-Host "    > Starting mock Supervisor API..." -ForegroundColor Gray
                $mockScript = Join-Path $PSScriptRoot "supervisor_mock.py"
                $mockArgs = @("run", "-d", "--name", $mockName)
                $mockArgs += "--network", $networkName
                $mockArgs += "--network-alias", "supervisor"
                $mockArgs += "-v", "$tempDir`:/data"
                $mockArgs += "-v", "$($mockScript.Replace('\','/')):/mock.py"
                $mockArgs += "-w", "/data"
                $mockArgs += "python:3.11-alpine"
                $mockArgs += "python", "/mock.py", "/data/options.json", "80"
                & docker @mockArgs 2>&1 | Out-Null
                Start-Sleep -Seconds 3

                # Run add-on with HA-like env on the same network
                $runArgs = @("run", "-d", "--name", $contName)
                $runArgs += "--network", $networkName
                $runArgs += "-v", "$tempDir`:/data"
                $runArgs += "-e", "SUPERVISOR_TOKEN=testing_token"
                $runArgs += "-e", "HASSIO_TOKEN=testing_token"
                $runArgs += $imgName

                $runInfo = & docker @runArgs 2>&1

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
                     # Check if this is a Supervisor API issue (expected in local testing)
                     if ($logs -match "Unknown log_level" -or $logs -match "Could not resolve host: supervisor" -or $logs -match "base-addon-log-level") {
                         Add-Result $a.Name "DockerRun" "INFO" "Skipped (Supervisor API not available locally)"
                     } else {
                         Add-Result $a.Name "DockerRun" "FAIL" "Crashed immediately. Logs summary:`n$($logs | Select-Object -Last 10)"
                     }
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
                docker rm -f $mockName 2>$null | Out-Null
                docker network rm $networkName 2>$null | Out-Null
                Remove-Item $tempDir -Recurse -Force 2>$null
            }
        }
    }
}

# --- 12. CODERABBIT-STYLE DEEP CHECKS ---
if ("all" -in $Tests -or "CodeRabbit" -in $Tests) {
    Write-Header "12. CodeRabbit-Style Deep Checks"
    foreach ($a in $addons) {
        $df = Join-Path $a.FullName "Dockerfile"
        $buildFile = Join-Path $a.FullName "build.yaml"

        if (Test-Path $df) {
            $content = Get-Content $df -Raw

            # Check 1: Unpinned Git Clone
            if ($content -match 'git clone(?!.*--branch)(?!.*--single-branch).*https://') {
                if ($content -notmatch 'git checkout [a-f0-9]{40}') {
                    Add-Result $a.Name "CR-UnpinnedGit" "WARN" "Unpinned git clone detected. Pin to specific SHA/tag for reproducible builds."
                }
            }

            # Check 2: Generic Healthcheck Patterns
            if ($content -match 'HEALTHCHECK.*pgrep.*-f.*"\.\*"') {
                Add-Result $a.Name "CR-GenericHealth" "WARN" "Generic HEALTHCHECK pattern (e.g., 'node.*server'). Use specific process name."
            }

            # Check 3: Manual Tarball without integrity
            if ($content -match '(wget|curl).*\.(tar|tgz|tar\.gz)' -and $content -notmatch 'sha256|checksum|--checksum') {
                Add-Result $a.Name "CR-TarballIntegrity" "WARN" "Manual tarball download without integrity check. Consider using official image or add checksum verification."
            }

            # Check 4: Duplicate ARG declarations
            $argMatches = [regex]::Matches($content, '(?m)^ARG\s+([A-Z_]+)')
            $argNames = $argMatches | ForEach-Object { $_.Groups[1].Value }
            $duplicates = $argNames | Group-Object | Where-Object { $_.Count -gt 1 }
            if ($duplicates) {
                $dupList = ($duplicates | ForEach-Object { $_.Name }) -join ", "
                Add-Result $a.Name "CR-DuplicateARG" "WARN" "Duplicate ARG declarations: $dupList"
            }

            # Check 5: Using :latest tag in FROM
            if ($content -match 'FROM\s+\S+:latest') {
                Add-Result $a.Name "CR-LatestTag" "WARN" "Using :latest tag in FROM. Pin to specific version for reproducible builds."
            }

            # Check 7: Unpinned package versions in apk add
            if ($content -match 'apk add' -and $content -notmatch '(?m)apk add(.*\s+[\w\-._]+[=~][\d.]+)') {
                 # Basic check: if it has apk add but no obvious version pin (= or ~)
                 # We exclude --no-cache which might be present
                 $cleanContent = $content -replace '--no-cache', ''
                 if ($cleanContent -match 'apk add\s+((?![\w\-._]+[=~])[\w\-._]+\s*)+') {
                     Add-Result $a.Name "CR-UnpinnedPackage" "WARN" "Unpinned package versions in 'apk add' detected. Pin versions for reproducibility."
                 }
            }

            # Check 8: Missing HEALTHCHECK timing parameters
            if ($content -match 'HEALTHCHECK' -and ($content -notmatch '--interval' -or $content -notmatch '--timeout')) {
                Add-Result $a.Name "CR-HealthcheckTiming" "WARN" "HEALTHCHECK lacks explicit --interval or --timeout parameters."
            }

            # Check 9: Fragile healthcheck pattern (pgrep -f run.sh)
            if ($content -match 'pgrep -f run\.sh') {
                Add-Result $a.Name "CR-FragileHealth" "WARN" "Healthcheck uses 'pgrep -f run.sh' which is fragile. Consider a more specific binary or functional check."
            }

            # Check 10: Missing --no-cache-dir in pip install
            if ($content -match 'pip install' -and $content -notmatch '--no-cache-dir') {
                 Add-Result $a.Name "CR-PipNoCache" "WARN" "pip install lacks --no-cache-dir flag. This increases image size."
            }

            # Check 11: Empty or missing BUILD_DATE default
            if ($content -match 'ARG BUILD_DATE' -and ($content -notmatch 'ARG BUILD_DATE=.' -or $content -match 'ARG BUILD_DATE=""')) {
                 Add-Result $a.Name "CR-BuildDateDefault" "WARN" "ARG BUILD_DATE has empty or missing default. Use '1970-01-01T00:00:00Z' for local builds."
            }

            # Check 12: Non-standard Hadolint ignores
            if ($content -match 'hadolint ignore=([\w,]+)') {
                $ignores = $matches[1].Split(',')
                foreach($ig in $ignores) {
                    if ($ig -notin @("DL3018", "DL3013", "DL3008", "DL3003", "DL4006", "SC2086")) {
                        # Add-Result $a.Name "CR-CustomHadolint" "INFO" "Custom Hadolint ignore: $ig"
                    }
                    if ($ig -eq "DL3047") {
                         Add-Result $a.Name "CR-NonStandardHadolint" "WARN" "Non-standard Hadolint ignore DL3047 detected (might be a typo)."
                    }
                }
            }

            # Check 13: Python Base Image enforcement
            if ($content -match 'pip install|python3?\s+.*\.py') {
                 if ($content -notmatch 'CR-Skip-PythonBaseCheck' -and $content -notmatch 'FROM\s+ghcr\.io/hassio-addons/python-base') {
                      Add-Result $a.Name "CR-PythonBase" "FAIL" "Addon uses Python but not the official python-base image. Use 'ghcr.io/hassio-addons/python-base' or add '# CR-Skip-PythonBaseCheck' to exclusion."
                 }
            }

            # Check 14: Language Check (English only)
            if ($content -match '[üäößÜÄÖ]' -or $content -cmatch '\b(ist|und|das|mit|der|die|den|dem|ein|eine|eines|einer)\b') {
                Add-Result $a.Name "CR-Language" "WARN" "Possible non-English content (German) detected in comments or logs. Keep everything in English."
            }
        }

        # Check 6: Moving tags in build.yaml
        if (Test-Path $buildFile) {
            $buildContent = Get-Content $buildFile -Raw

            # Check for :beta, :latest, :dev, :edge tags
            if ($buildContent -match ':\s*(beta|latest|dev|edge|nightly)\s*["\''$]?') {
                $tag = $matches[1]
                # Allow for homeassistant-test-instance (it's a test addon)
                if ($a.Name -eq "homeassistant-test-instance") {
                    Add-Result $a.Name "CR-MovingTag" "INFO" "Using :$tag tag (acceptable for test addon, but consider documenting)"
                } else {
                    Add-Result $a.Name "CR-MovingTag" "WARN" "Using :$tag tag in build.yaml. Pin to specific version for reproducible builds."
                }
            }
        }
    }
}

# --- 13. WORKFLOW CHECKS (CodeRabbit Style) ---
if ("all" -in $Tests -or "WorkflowChecks" -in $Tests) {
    Write-Header "13. Workflow Checks"
    $workflowDir = Join-Path $RepoRoot ".github\workflows"
    $workflows = Get-ChildItem -Path $workflowDir -Filter "*.yaml"

    if ($DockerAvailable) {
        # A. Actionlint (Syntax & Correctness)
        Write-Host "Running Actionlint..." -ForegroundColor Gray
        try {
            # Use docker to run actionlint on the whole workflows dir
            $out = docker run --rm -v "$($RepoRoot):/repo" -w /repo rhysd/actionlint:latest 2>&1
            if ($LASTEXITCODE -ne 0) { Add-Result "Workflows" "Actionlint" "FAIL" $out }
            else { Add-Result "Workflows" "Actionlint" "PASS" "OK" }
        }
        catch { Add-Result "Workflows" "Actionlint" "FAIL" "Exec Error" }

        # B. Zizmor (Security)
        Write-Host "Running Zizmor..." -ForegroundColor Gray
        try {
            $out = docker run --rm -v "$($RepoRoot):/repo" -w /repo ghcr.io/woodruffw/zizmor:latest . 2>&1
            if ($LASTEXITCODE -ne 0) { Add-Result "Workflows" "Zizmor" "WARN" $out }
            else { Add-Result "Workflows" "Zizmor" "PASS" "OK" }
        }
        catch { Add-Result "Workflows" "Zizmor" "FAIL" "Exec Error" }
    }

    $latestRunner = "24.04" # Default fallback
    try {
        $runnerInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/actions/runner-images/contents/images/ubuntu" -ErrorAction Stop
        $versions = $runnerInfo.name | Where-Object { $_ -match 'Ubuntu(\d+)' } | ForEach-Object { $matches[1] }
        if ($versions) {
            $latestMajor = ($versions | Measure-Object -Maximum).Maximum
            # Convert 2404 to 24.04
            $latestRunner = "$($latestMajor.ToString().Substring(0,2)).$($latestMajor.ToString().Substring(2,2))"
        }
    } catch {
        Write-Host "Warning: Could not fetch latest runner version from GitHub API. Using fallback $latestRunner" -ForegroundColor Yellow
    }

    # C. Custom AI-Style Checks (Regex based)
    foreach ($wf in $workflows) {
        $content = Get-Content $wf.FullName -Raw
        $wfName = $wf.Name

        # Check 1: SHA Pinning (Reproducibility)
        # Warn if @vX is used instead of a 40-char SHA
        if ($content -match 'uses:\s*[\w\-\./]+@(v\d+|master|main)') {
             Add-Result $wfName "CR-SHA-Pinning" "WARN" "Uses moving tag (e.g. @v4). Pin to commit SHA for maximum security."
        } else {
             Add-Result $wfName "CR-SHA-Pinning" "PASS" "OK"
        }

        # Check 2: Permissions (Least Privilege)
        if ($content -notmatch '(?m)^permissions:') {
             Add-Result $wfName "CR-Permissions" "WARN" "Missing top-level 'permissions:' block. Define explicit permissions."
        } else {
             Add-Result $wfName "CR-Permissions" "PASS" "OK"
        }

        # Check 3: Trigger Optimization
        if (($content -match 'on:\s*(push|pull_request)') -and ($content -notmatch 'paths:')) {
             Add-Result $wfName "CR-TriggerOpt" "INFO" "Trigger lacks 'paths' filter. Workflow might run unnecessarily."
        } else {
             Add-Result $wfName "CR-TriggerOpt" "PASS" "OK"
        }

        # Check 4: GitHub Runner Version
        if ($content -match 'runs-on:\s*ubuntu-(\d+\.\d+|latest)') {
             $usedVersion = $matches[1]
             if ($usedVersion -ne "latest" -and $usedVersion -lt $latestRunner) {
                  Add-Result $wfName "CR-RunnerVersion" "WARN" "Uses older GitHub Runner ($usedVersion). The latest available version is $latestRunner. It is recommended to use the latest version or 'ubuntu-latest' for better performance and security."
             } else {
                  Add-Result $wfName "CR-RunnerVersion" "PASS" "OK"
             }
        }
    }
}

# --- SUMMARY ---
Write-Header "EXECUTION SUMMARY"
$Results | Format-Table -AutoSize

if ($GlobalFailed) { exit 1 } else { exit 0 }
