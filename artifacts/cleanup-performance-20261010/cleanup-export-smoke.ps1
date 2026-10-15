$ErrorActionPreference = 'Stop'
$expectedRoot = 'D:\racing\three-rapier-idiom-racer\artifacts\cleanup-performance-20261010\export-smoke'
$root = (Resolve-Path -LiteralPath $expectedRoot).Path
if ($root -ne $expectedRoot) { throw 'Unexpected export-smoke root' }
$folder = Get-Item -LiteralPath $root -Force
if ($folder.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Directory link rejected' }
$expected = @{ 'supra.glb' = 582932; 'garage.glb' = 132284 }
$targets = @()
foreach ($name in $expected.Keys) {
    $file = Get-Item -LiteralPath (Join-Path $root $name) -Force
    $resolved = (Resolve-Path -LiteralPath $file.FullName).Path
    if ((Split-Path $resolved -Parent) -ne $root -or $file.PSIsContainer -or $file.Length -ne $expected[$name] -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Unexpected temporary export: $name" }
    $targets += $resolved
}
# Only the two verified, generated leaf files; no recursive or wildcard deletion.
foreach ($target in $targets) { Remove-Item -LiteralPath $target -Force }
if (-not (Get-ChildItem -LiteralPath $root -Force | Select-Object -First 1)) { Remove-Item -LiteralPath $root -Force }
Write-Output 'Removed only the two verified temporary Blender export files.'
