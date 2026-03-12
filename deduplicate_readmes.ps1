$files = Get-ChildItem -Path . -Filter README.md -Recurse -Exclude node_modules, .git

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $original = $content

    # Fix 1: License/Maintenance duplication (Middle of file before any header)
    $p1 = "This project is open-source and available under the MIT License.\r?\nMaintained by \*\*FaserF\*\*.\r?\n\r?\n(?=## )"
    $content = [regex]::Replace($content, $p1, "")

    # Fix 2: Description duplication
    # Specifically remove the middle one if it's followed by some space and then a header
    $lines = $content -split "\r?\n"
    if ($lines.Count -gt 20) {
        $foundFirst = $false
        for ($i=0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^> Home Assistant WhatsApp App \(Baileys/Node\.js\)\.$") {
                if (-not $foundFirst) {
                    $foundFirst = $true
                } else {
                    # This is the second occurrence. Check if next non-empty line is a header
                    $foundHeader = $false
                    for ($j=$i+1; $j -lt $lines.Count; $j++) {
                        if (-not [string]::IsNullOrWhiteSpace($lines[$j])) {
                            if ($lines[$j] -match "^## ") {
                                $foundHeader = $true
                            }
                            break
                        }
                    }
                    if ($foundHeader) {
                        $lines[$i] = $null
                        # Also null out the previous line if it was empty
                        if ($i - 1 -ge 0 -and [string]::IsNullOrWhiteSpace($lines[$i-1])) {
                             $lines[$i-1] = $null
                        }
                        Write-Host "Removed redundant description in $($file.FullName) at line $($i+1)"
                    }
                }
            }
        }
        $content = ($lines | Where-Object { $_ -ne $null }) -join "`r`n"
    }

    if ($content -ne $original) {
        $content | Set-Content -Path $file.FullName -NoNewline
        Write-Host "Fixed: $($file.FullName)"
    }
}
