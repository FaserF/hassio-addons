$files = Get-ChildItem -Path . -Filter README.md -Recurse -Exclude node_modules, .git

$bugText = "If you encounter any issues with this app, please report them using the link below. The issue form will be pre-filled with the app information to help us resolve the problem faster."
$featureText = "If you have an idea for a new feature or improvement, please use the link below to submit a feature request. The form will be pre-filled with the app information."

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw

    # We target the case where these sentences are under the About section
    # and also exist later in the file.

    # Pattern: ## About followed by the text followed by ## Report a Bug
    $aboutTextPattern = "## 📖 About\s+" + [regex]::Escape($bugText) + "\s+" + [regex]::Escape($featureText) + "\s+(?=## 🐛 Report a Bug)"

    if ($content -match $aboutTextPattern) {
        $content = $content -replace $aboutTextPattern, "## 📖 About`n`n"
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Deduplicated $($file.FullName)"
    }
}
