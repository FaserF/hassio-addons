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
        (Test-Path "$($_.FullName)\config.yaml") -and ($_.Name -ne ".git") -and ($_.Name -ne ".unsupported")
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
    try {
        $target = if ($Addon.Count -eq 1 -and $Addon[0] -eq "all") { "**/*.md" } else { "$($addons[0].FullName)\**\*.md" }
        npx markdownlint-cli $target --config .markdownlint.yaml --ignore "node_modules" --ignore ".git" --ignore ".unsupported"
        if ($LASTEXITCODE -ne 0) { throw "Fail" }
        Add-Result "All" "MarkdownLint" "PASS" "OK"
    }
    catch {
        Add-Result "All" "MarkdownLint" "FAIL" "Errors found (See log)"
    }
}

# --- 6. PRETTIER ---
if ("all" -in $Tests -or "Prettier" -in $Tests) {
    Write-Header "6. Prettier"
    try {
        $ptarget = if ($Addon.Count -eq 1 -and $Addon[0] -eq "all") { "**/*.{json,js,md,yaml}" } else { "$($addons[0].FullName)\**\*.{json,js,md,yaml}" }
        npx prettier --check $ptarget --ignore-path .prettierignore
        if ($LASTEXITCODE -ne 0) { throw "Fail" }
        Add-Result "All" "Prettier" "PASS" "OK"
    }
    catch {
        Add-Result "All" "Prettier" "FAIL" "Formatting issues"
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
    if ($DockerAvailable -and -not $GlobalFailed) {
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
                # Run
                $contName = "test-run-$($a.Name.ToLower())"
                docker rm -f $contName 2>$null
                $runInfo = docker run -d --name $contName $imgName 2>&1
                Start-Sleep -Seconds 5
                if ((docker inspect -f '{{.State.Running}}' $contName) -eq "true") {
                    Add-Result $a.Name "DockerRun" "PASS" "Running"
                }
                else {
                    Add-Result $a.Name "DockerRun" "FAIL" "Crashed"
                }
                docker rm -f $contName 2>$null
            }
        }
    }
}

# --- SUMMARY ---
Write-Header "EXECUTION SUMMARY"
$Results | Format-Table -AutoSize

if ($GlobalFailed) { exit 1 } else { exit 0 }
