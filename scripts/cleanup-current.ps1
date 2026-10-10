param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath 'D:\racing').Path.TrimEnd('\')
$manifestPath = Join-Path $PSScriptRoot '..\artifacts\cleanup-performance-20261010\cleanup-manifest.json'
$report = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
function CheckTarget([string]$path) {
    $resolved = (Resolve-Path -LiteralPath $path).Path
    if (-not $resolved.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Outside workspace: $resolved" }
    if ($resolved -match '(?i)[\\/]\.git([\\/]|$)') { throw 'Git history is protected' }
    $item = Get-Item -LiteralPath $resolved -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Link rejected: $resolved" }
    return $resolved
}
# Check EVERY candidate before the first deletion. Delete literal files only.
$checkedParents = @{}
foreach ($item in $report.removals) {
    $target = CheckTarget $item.path
    if ((Get-Item -LiteralPath $target).Length -ne $item.bytes) { throw "Candidate changed: $target" }
    $parent = Split-Path $target -Parent
    while ($parent -ne $workspace -and -not $checkedParents.ContainsKey($parent)) { [void](CheckTarget $parent); $checkedParents[$parent] = $true; $parent = Split-Path $parent -Parent }
}
if (-not $Apply) { Write-Output "Checked $($report.plannedFiles) files; $($report.plannedBytes) bytes. No deletion."; return }
$deletedBytes = [long]0; $deletedFiles = 0
foreach ($item in $report.removals) {
    $target = CheckTarget $item.path
    Remove-Item -LiteralPath $target -Force
    $deletedBytes += $item.bytes; $deletedFiles++
}
foreach ($item in $report.protectedFiles) {
    if (-not (Test-Path -LiteralPath $item.path) -or (Get-FileHash -LiteralPath $item.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256) { throw "Protected file changed: $($item.path)" }
}
# Empty directories have no content to preserve; never enter Git/node_modules.
$dirs = Get-ChildItem -LiteralPath $workspace -Directory -Recurse -Force | Where-Object FullName -NotMatch '[\\/](\.git|node_modules|\.claude)([\\/]|$)' | Sort-Object { $_.FullName.Length } -Descending
foreach ($dir in $dirs) {
    if (-not (Get-ChildItem -LiteralPath $dir.FullName -Force | Select-Object -First 1)) { $target = CheckTarget $dir.FullName; Remove-Item -LiteralPath $target -Force }
}
[pscustomobject]@{Date=(Get-Date).ToString('s');DeletedBytes=$deletedBytes;DeletedFiles=$deletedFiles;ProtectedFilesVerified=$report.protectedFiles.Count} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path (Split-Path $manifestPath) 'cleanup-result.json') -Encoding utf8
Write-Output "Deleted $deletedFiles files; $([math]::Round($deletedBytes/1MB,2)) MiB. All protected hashes verified."
