[CmdletBinding()]
param([string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$ptzRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
foreach ($ptzRelative in @('example\obs-scene-collection.json','example\sphere_2880x1440.jpg','shaders\insta360_ptz_reframe.shader','dock\insta360-ptz.html')) {
    if (-not (Test-Path -LiteralPath (Join-Path $ptzRoot $ptzRelative) -PathType Leaf)) { throw "Required file missing: $ptzRelative" }
}
$ptzTemplate = Get-Content -LiteralPath (Join-Path $ptzRoot 'example\obs-scene-collection.json') -Raw
# JSON-escape the root before substituting it into JSON string values.
$ptzEscapedRoot = ConvertTo-Json -InputObject ($ptzRoot.Replace('\','/')) -Compress
$ptzEscapedRoot = $ptzEscapedRoot.Substring(1, $ptzEscapedRoot.Length - 2)
$ptzPrepared = $ptzTemplate.Replace('__REPO_ROOT__', $ptzEscapedRoot)
$null = ConvertFrom-Json -InputObject $ptzPrepared
$ptzLocal = Join-Path $ptzRoot '.local'
$null = New-Item -ItemType Directory -Path $ptzLocal -Force
$ptzOutput = Join-Path $ptzLocal 'obs-scene-collection.json'
[IO.File]::WriteAllText($ptzOutput, $ptzPrepared, (New-Object Text.UTF8Encoding($false)))
Write-Output "Import this scene collection in OBS: $ptzOutput"
$ptzDockUri = New-Object System.Uri((Join-Path $ptzRoot 'dock\insta360-ptz.html'))
Write-Output "Custom browser dock URL: $($ptzDockUri.AbsoluteUri)"
