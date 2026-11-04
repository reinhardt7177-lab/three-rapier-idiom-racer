param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath 'D:\racing\three-rapier-idiom-racer').Path
$auditRoot = Join-Path $repoRoot 'artifacts\online-review-20261015'
$inventory = Get-Content -LiteralPath (Join-Path $auditRoot 'cleanup-inventory.json') -Raw | ConvertFrom-Json
$sourceText = (Get-ChildItem -LiteralPath (Join-Path $repoRoot 'src'),(Join-Path $repoRoot 'scripts') -File -Recurse | Where-Object Extension -in '.js','.jsx','.mjs','.py','.ps1' | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }) -join "`n"
$files = [Collections.Generic.List[object]]::new()
$links = [Collections.Generic.List[string]]::new()
$required = [Collections.Generic.List[string]]::new()
function InventoryFiles([string]$dir) {
    foreach ($entry in Get-ChildItem -LiteralPath $dir -Force) {
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { $links.Add($entry.FullName); continue }
        if ($entry.PSIsContainer) { InventoryFiles $entry.FullName }
        elseif ($entry.Name -notmatch '(?i)(^\.env|\.key$|credentials|auth\.json|token)') { $files.Add([pscustomobject]@{Path=$entry.FullName;Bytes=$entry.Length;Ticks=$entry.LastWriteTimeUtc.Ticks}) }
    }
}
foreach ($candidate in $inventory.candidates) {
    if (-not (Test-Path -LiteralPath $candidate.path)) { continue }
    $target = (Resolve-Path -LiteralPath $candidate.path).Path
    if (-not $target.StartsWith((Join-Path $repoRoot 'artifacts') + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Candidate outside artifacts' }
    if ($target.StartsWith($auditRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { continue }
    $relative = $target.Substring($repoRoot.Length+1).Replace('\','/')
    if ($sourceText.Contains($relative)) { $required.Add($relative); continue }
    $entry = Get-Item -LiteralPath $target -Force
    if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { $links.Add($target); continue }
    if ($entry.PSIsContainer) { InventoryFiles $target }
    else { $files.Add([pscustomobject]@{Path=$target;Bytes=$entry.Length;Ticks=$entry.LastWriteTimeUtc.Ticks}) }
}
$checkedParents = @{}
foreach ($file in $files) {
    $target = (Resolve-Path -LiteralPath $file.Path).Path
    if (-not $target.StartsWith($repoRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'File outside repository' }
    $entry = Get-Item -LiteralPath $target -Force
    if ($entry.PSIsContainer -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Not a regular file' }
    $parent = Split-Path -Parent $target
    while ($parent -ne $repoRoot -and -not $checkedParents.ContainsKey($parent)) {
        $dir = Get-Item -LiteralPath $parent -Force
        if ($dir.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked ancestor rejected' }
        $checkedParents[$parent] = $true
        $parent = Split-Path -Parent $parent
    }
}
$plan = [pscustomobject]@{Files=$files.Count;Bytes=($files | Measure-Object Bytes -Sum).Sum;PreservedLinks=$links;RequiredByCode=$required;Candidates=$files}
$plan | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $auditRoot 'cleanup-regular-plan.json') -Encoding utf8
if (-not $Apply) { [pscustomobject]@{Mode='dry-run';Files=$plan.Files;Bytes=$plan.Bytes;PreservedLinks=$links.Count} | ConvertTo-Json; return }
$deleted = [Collections.Generic.List[object]]::new()
foreach ($file in $files) {
    $entry = Get-Item -LiteralPath $file.Path -Force
    if ($entry.Length -ne $file.Bytes -or $entry.LastWriteTimeUtc.Ticks -ne $file.Ticks) { throw "File changed since inventory: $($file.Path)" }
    Remove-Item -LiteralPath $file.Path -Force
    $deleted.Add($file)
}
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules\vite\package.json'))) { throw 'Original dependencies missing' }
$result = [pscustomobject]@{At=(Get-Date).ToString('o');DeletedFiles=$deleted.Count;DeletedBytes=($deleted | Measure-Object Bytes -Sum).Sum;PreservedLinks=$links;Method='Literal regular files only; no recursion during deletion, no link removed or followed';Files=$deleted}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $auditRoot 'cleanup-regular-result.json') -Encoding utf8
[pscustomobject]@{DeletedFiles=$result.DeletedFiles;DeletedBytes=$result.DeletedBytes;PreservedLinks=$links.Count} | ConvertTo-Json
