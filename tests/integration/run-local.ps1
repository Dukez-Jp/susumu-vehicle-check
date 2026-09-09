[CmdletBinding()]
param(
    [switch]$SkipMobile,
    [string]$PortableEnvironment = 'C:\Dev\tools\SUSUMU-env.ps1'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (Test-Path -LiteralPath $PortableEnvironment) { . $PortableEnvironment }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$secretPath = Join-Path $repo '.local\local-runtime-secrets.json'
if (-not (Test-Path -LiteralPath $secretPath)) { throw 'Run scripts/start-local.ps1 first to prepare the isolated DEV environment.' }
$runtime = Get-Content -Raw -LiteralPath $secretPath | ConvertFrom-Json
if ($runtime.environment -ne 'Development') { throw 'This runner accepts the local Development fixture only.' }
Invoke-RestMethod 'http://127.0.0.1:5080/api/v1/health/ready' -TimeoutSec 10 | Out-Null
$variables = @{
    SUSUMU_API_URL = 'http://127.0.0.1:5080/api/v1/'
    SUSUMU_TEST_API = 'http://127.0.0.1:5080'
    SUSUMU_TEST_USERNAME = $runtime.adminUsername
    SUSUMU_TEST_USER = $runtime.adminUsername
    SUSUMU_TEST_PASSWORD = $runtime.adminPassword
}
$previous = @{}
foreach ($key in $variables.Keys) {
    $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
    [Environment]::SetEnvironmentVariable($key, $variables[$key], 'Process')
}
Push-Location $repo
try {
    & node tests/integration/api-smoke.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Real PostgreSQL API integration failed.' }
    if (-not $SkipMobile) {
        Push-Location mobile
        try {
            & flutter test test/live_api_contract.dart --dart-define=ALLOW_HTTP_DEV=true
            if ($LASTEXITCODE -ne 0) { throw 'Real Flutter/SQLite/API integration failed.' }
        } finally { Pop-Location }
    }
    Write-Host 'Selected local integration checks passed with synthetic records. No credentials were printed.'
} finally {
    Pop-Location
    foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
}
