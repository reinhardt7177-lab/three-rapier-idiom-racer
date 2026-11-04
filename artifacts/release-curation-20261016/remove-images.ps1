$ErrorActionPreference = 'Stop'
$workspaceRoot = (Resolve-Path -LiteralPath 'D:/racing/three-rapier-idiom-racer').Path
$manifestPath = Join-Path $workspaceRoot 'artifacts/release-curation-20261016/image-removal-manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json -DateKind String
$artifactRoot = (Resolve-Path -LiteralPath (Join-Path $workspaceRoot 'artifacts')).Path + [IO.Path]::DirectorySeparatorChar
$selected = Get-Content -LiteralPath (Join-Path $workspaceRoot 'docs/blog/image-index.json') -Raw | ConvertFrom-Json
if ($selected.count -ne 20 -or $selected.images.Count -ne 20) { throw 'Exactly twenty selected images required' }
foreach ($image in $selected.images) {
  $savedPath = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $image.path))
  if (-not $savedPath.StartsWith((Join-Path $workspaceRoot 'docs/blog/images') + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Selected path escaped image folder' }
  if ((Get-FileHash -LiteralPath $savedPath -Algorithm SHA256).Hash -ne $image.sha256) { throw 'Selected image changed' }
}
$checked = foreach ($entry in $manifest.files) {
  $target = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $entry.path))
  if (-not $target.StartsWith($artifactRoot,[StringComparison]::OrdinalIgnoreCase)) { throw ('Target outside artifacts: ' + $target) }
  if ($target -notmatch '\.(png|jpe?g|gif|webp|svg)$') { throw 'Only image files are authorized here' }
  $item = Get-Item -LiteralPath $target -Force
  if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Not an ordinary file' }
  $parent = $item.Directory
  while ($parent.FullName.StartsWith($workspaceRoot,[StringComparison]::OrdinalIgnoreCase)) {
    if ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Reparse parent rejected' }
    $parent = $parent.Parent
  }
  if ($item.Length -ne $entry.bytes -or $item.LastWriteTimeUtc.Ticks -ne ([DateTimeOffset]::Parse($entry.mtime)).UtcTicks) { throw ('Image changed: ' + $entry.path) }
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $entry.sha256) { throw ('Image hash changed: ' + $entry.path) }
  [pscustomobject]@{path=$target;relative=$entry.path;bytes=$item.Length}
}
$removed = @()
foreach ($item in $checked) { Remove-Item -LiteralPath $item.path -Force; $removed += [pscustomobject]@{path=$item.relative;bytes=$item.bytes} }
$report = [pscustomobject]@{at=[datetime]::UtcNow.ToString('o');deleted=$removed.Count;bytes=($removed | Measure-Object -Property bytes -Sum).Sum;kept=20;files=$removed}
$report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $workspaceRoot 'artifacts/release-curation-20261016/image-cleanup-result.json') -Encoding UTF8
$report | Select-Object at,deleted,bytes,kept | ConvertTo-Json
