[CmdletBinding()]
param([string]$PgBin = 'C:\Dev\tools\postgresql18\pgsql\bin')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-common.ps1')
$repo = Get-SusumuRepoRoot
$runtimeLock = Get-SusumuRuntimeLock
try {
$state = Get-SusumuState
if ($state.version -ne 1 -or $state.repository -ne $repo) { throw 'Process state belongs to another repository or unsupported version.' }
$apiAssembly = Join-Path $repo 'backend\src\Susumu.Api\bin\Release\net10.0\Susumu.Api.dll'
$viteScript = Join-Path $repo 'admin-web\node_modules\vite\bin\vite.js'
if (Stop-SusumuOwnedProcess $state.web 'web' $viteScript) { $state.web = $null }
if (Stop-SusumuOwnedProcess $state.api 'api' $apiAssembly) { $state.api = $null }
$data = Join-Path (Get-SusumuPrivateDirectory) 'postgres\data'
if (Test-SusumuOwnedProcess $state.database 'database' $data) {
    $postmasterId = [int](Get-Content -LiteralPath (Join-Path $data 'postmaster.pid') -TotalCount 1)
    if ($postmasterId -ne [int]$state.database.pid) { throw 'PostgreSQL ownership changed; managed database was preserved.' }
    & (Join-Path $PgBin 'pg_ctl.exe') stop -D $data -m fast -w -t 60
    if ($LASTEXITCODE -ne 0) { throw 'Managed PostgreSQL did not stop cleanly; no data was deleted.' }
    $state.database = $null
    Write-Host 'Stopped the PostgreSQL process started by this script; cluster files preserved.'
} elseif ($null -ne $state.database) {
    Write-Host 'Preserved PostgreSQL: it was reused or no longer matches script ownership.'
}
Save-SusumuState $state
Write-Host 'Local stop completed. No databases, photos, credentials, or unrelated processes were deleted.'
} finally { $runtimeLock.Dispose() }
