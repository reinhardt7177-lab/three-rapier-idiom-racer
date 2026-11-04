$ErrorActionPreference='Stop'
$taskRoot=(Resolve-Path -LiteralPath '.').Path
$artifactRoot=Join-Path $taskRoot 'artifacts'
$plan=Get-Content -LiteralPath 'artifacts/release-curation-20261016/temp-removal-plan.json' -Raw | ConvertFrom-Json
$checked=@()
foreach($entry in $plan.files){
 $item=Get-Item -LiteralPath (Join-Path $taskRoot $entry.path)
 if(-not $item.FullName.StartsWith($artifactRoot+[IO.Path]::DirectorySeparatorChar) -or $item.PSIsContainer){throw 'Target outside artifacts'}
 $parent=$item
 while($parent.FullName -ne $taskRoot){if($parent.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked target refused'};$parent=Get-Item -LiteralPath ([IO.Path]::GetDirectoryName($parent.FullName))}
 if($item.Length -ne $entry.bytes -or (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'File changed since inventory'}
 $checked+=@{path=$entry.path;fullName=$item.FullName;bytes=$item.Length;ticks=$item.LastWriteTimeUtc.Ticks;sha256=$entry.sha256;reason=$entry.reason}
}
$deleted=@()
foreach($item in $checked){
 $fresh=Get-Item -LiteralPath $item.fullName
 if($fresh.Length -ne $item.bytes -or $fresh.LastWriteTimeUtc.Ticks -ne $item.ticks){throw 'Concurrent modification detected'}
 Remove-Item -LiteralPath $item.fullName
 $deleted+=@{path=$item.path;bytes=$item.bytes;sha256=$item.sha256;reason=$item.reason}
}
$result=@{count=$deleted.Count;bytes=($deleted|Measure-Object -Property bytes -Sum).Sum;files=$deleted}
$result|ConvertTo-Json -Depth 8|Set-Content -LiteralPath 'artifacts/release-curation-20261016/temp-cleanup-result.json' -Encoding utf8
@{count=$result.count;bytes=$result.bytes}|ConvertTo-Json -Compress
