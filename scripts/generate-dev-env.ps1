[CmdletBinding()]
param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
& python (Join-Path $PSScriptRoot 'generate_dev_env.py') --root $Root
if ($LASTEXITCODE -ne 0) { throw 'DEV environment was not regenerated; existing files preserved.' }
