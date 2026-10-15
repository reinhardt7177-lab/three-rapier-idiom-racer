$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath 'D:\racing').Path.TrimEnd('\')
function CheckedDirectory([string]$path) {
    $resolved = (Resolve-Path -LiteralPath $path).Path
    if (-not $resolved.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) { throw "Outside workspace: $resolved" }
    if ($resolved -match '(?i)[\\/](\.git|node_modules|\.claude)([\\/]|$)') { throw "Protected directory: $resolved" }
    if ((Get-Item -LiteralPath $resolved -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Link rejected: $resolved" }
    return $resolved
}
$directories = Get-ChildItem -LiteralPath $workspace -Directory -Recurse -Force | Where-Object FullName -NotMatch '[\\/](\.git|node_modules|\.claude)([\\/]|$)' | Sort-Object { $_.FullName.Length } -Descending
$count = 0
foreach ($dir in $directories) {
    $target = CheckedDirectory $dir.FullName
    if (-not (Get-ChildItem -LiteralPath $target -Force | Select-Object -First 1)) {
        # Native non-recursive removal: this cannot erase directory contents.
        Remove-Item -LiteralPath $target -Force
        $count++
    }
}
Write-Output "Removed $count empty workspace directories."
