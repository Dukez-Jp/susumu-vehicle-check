[CmdletBinding()]
param(
    [string]$PortableEnvironment = 'C:\Dev\tools\SUSUMU-env.ps1',
    [string]$PgBin = 'C:\Dev\tools\postgresql18\pgsql\bin',
    [switch]$SkipBuild,
    [switch]$PrepareOnly
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-common.ps1')
if (Test-Path -LiteralPath $PortableEnvironment) { . $PortableEnvironment }
$repo = Get-SusumuRepoRoot
$private = Get-SusumuPrivateDirectory
$secretValues = Get-SusumuRuntimeSecrets
if ($PrepareOnly) {
    Write-Host 'Prepared .local/local-runtime-secrets.json. Secret values were not displayed; no service was started.'
    return
}
$runtimeLock = Get-SusumuRuntimeLock
try {
$state = Get-SusumuState
if ($state.version -ne 1 -or $state.repository -ne $repo) { throw 'Process state belongs to another repository or unsupported version.' }
$data = Join-Path $private 'postgres\data'
$passwordPath = Join-Path $private 'postgres\password.txt'
$pgControl = Join-Path $PgBin 'pg_ctl.exe'
$postgres = Join-Path $PgBin 'postgres.exe'
if (-not (Test-Path -LiteralPath $data) -or -not (Test-Path -LiteralPath $passwordPath) -or -not (Test-Path -LiteralPath $pgControl)) {
    throw 'The managed portable PostgreSQL cluster is missing. Follow the native setup documentation; no system database will be altered.'
}
if ((Get-Content -Raw -LiteralPath (Join-Path $data 'PG_VERSION')).Trim() -ne '18') { throw 'Managed cluster is not PostgreSQL 18.' }
$logs = Join-Path $private 'logs'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$apiAssembly = Join-Path $repo 'backend\src\Susumu.Api\bin\Release\net10.0\Susumu.Api.dll'
$viteScript = Join-Path $repo 'admin-web\node_modules\vite\bin\vite.js'
$dotnet = (Get-Command dotnet -ErrorAction Stop).Source
$node = (Get-Command node -ErrorAction Stop).Source
if ((Test-SusumuPort 5080) -and -not (Test-SusumuOwnedProcess $state.api 'api' $apiAssembly)) {
    throw 'Port 5080 is occupied by an API/process not owned by this script. It was preserved.'
}
Push-Location $repo
try {
    if (-not $SkipBuild -and -not (Test-SusumuOwnedProcess $state.api 'api' $apiAssembly)) {
        & $dotnet build backend/src/Susumu.Api/Susumu.Api.csproj -c Release
        if ($LASTEXITCODE -ne 0) { throw 'API build failed; services were not started.' }
    }
    if (-not (Test-Path -LiteralPath $apiAssembly)) { throw 'Release API assembly missing; rerun without -SkipBuild.' }
    if (-not (Test-Path -LiteralPath $viteScript)) {
        Push-Location admin-web
        try { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Admin dependency installation failed.' } }
        finally { Pop-Location }
    }
    & $pgControl status -D $data *> $null
    if ($LASTEXITCODE -ne 0) {
        if (Test-SusumuPort 55432) { throw 'Port 55432 is occupied by an unrelated PostgreSQL/process; preserved.' }
        $pgArgs = @('start','-D',('"'+$data+'"'),'-l',('"'+(Join-Path $logs 'postgresql.log')+'"'),'-o','"-h 127.0.0.1 -p 55432"','-w','-t','60')
        $launcher = Start-Process -FilePath $pgControl -ArgumentList $pgArgs -WindowStyle Hidden -PassThru -Wait
        if ($launcher.ExitCode -ne 0) { throw 'Managed PostgreSQL failed to start; inspect .local/logs/postgresql.log.' }
        $postmasterId = [int](Get-Content -LiteralPath (Join-Path $data 'postmaster.pid') -TotalCount 1)
        $state.database = Get-SusumuProcessRecord (Get-Process -Id $postmasterId) 'database' $postgres $data
        Save-SusumuState $state
    } elseif (-not (Test-SusumuOwnedProcess $state.database 'database' $data)) {
        $state.database = [pscustomobject]@{ kind = 'database'; startedByScript = $false; marker = $data }
        Write-Host 'Reusing the existing managed PostgreSQL cluster; stop-local will preserve it.'
    }
    $variables = @{
        ASPNETCORE_ENVIRONMENT = 'Development'; ASPNETCORE_URLS = 'http://127.0.0.1:5080'
        SUSUMU_DB_PROVIDER = 'postgres'; Database__ApplyMigrationsAtStartup = 'true'
        SUSUMU_DB_CONNECTION = ('Host=127.0.0.1;Port=55432;Database=susumu_dev;Username=susumu_dev;Password=' + [IO.File]::ReadAllText($passwordPath).Trim())
        SUSUMU_JWT_SIGNING_KEY = $secretValues.jwtSigningKey
        SUSUMU_BOOTSTRAP_ADMIN_USERNAME = $secretValues.adminUsername
        SUSUMU_BOOTSTRAP_ADMIN_PASSWORD = $secretValues.adminPassword
        SUSUMU_DEV_SEED = 'true'; SUSUMU_PHOTO_ROOT = (Join-Path $private 'photo-storage')
        DevSeed__CredentialsFilePath = (Join-Path $private 'generated-role-credentials.json')
        API_PROXY_TARGET = 'http://127.0.0.1:5080'
    }
    $previous = @{}
    foreach ($key in $variables.Keys) { $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process'); [Environment]::SetEnvironmentVariable($key, $variables[$key], 'Process') }
    try {
        if (-not (Test-SusumuOwnedProcess $state.api 'api' $apiAssembly)) {
            $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
            $api = Start-Process -FilePath $dotnet -ArgumentList ('"'+$apiAssembly+'"') -WorkingDirectory (Join-Path $repo 'backend\src\Susumu.Api') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs "api-$stamp.out.log") -RedirectStandardError (Join-Path $logs "api-$stamp.err.log")
            $state.api = Get-SusumuProcessRecord $api 'api' $dotnet $apiAssembly
            Save-SusumuState $state
        }
        Wait-SusumuHttp 'http://127.0.0.1:5080/api/v1/health/ready'
        if (-not (Test-SusumuPort 5173)) {
            $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
            $web = Start-Process -FilePath $node -ArgumentList @(('"'+$viteScript+'"'),'--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory (Join-Path $repo 'admin-web') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs "web-$stamp.out.log") -RedirectStandardError (Join-Path $logs "web-$stamp.err.log")
            $state.web = Get-SusumuProcessRecord $web 'web' $node $viteScript
            Save-SusumuState $state
        } elseif (-not (Test-SusumuOwnedProcess $state.web 'web' $viteScript)) {
            $listener = Get-NetTCPConnection -State Listen -LocalPort 5173 | Select-Object -First 1
            $existing = Get-CimInstance Win32_Process -Filter ("ProcessId = " + [int]$listener.OwningProcess)
            $command = $existing.CommandLine.Replace('/', '\').ToLowerInvariant()
            if ([IO.Path]::GetFileName($existing.ExecutablePath) -ne 'node.exe' -or -not $command.Contains((Join-Path $repo 'admin-web').ToLowerInvariant()) -or -not $command.Contains('vite')) {
                throw 'Port 5173 belongs to an unrelated process; it was preserved.'
            }
            $state.web = [pscustomobject]@{ kind = 'web'; startedByScript = $false; marker = $viteScript }
            Write-Host 'Reusing the existing project Vite server on 5173; stop-local will preserve it.'
        }
        Wait-SusumuHttp 'http://127.0.0.1:5173/' 30
        Wait-SusumuHttp 'http://127.0.0.1:5173/api/v1/health/ready' 30
        Save-SusumuState $state
    } finally {
        foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
        $variables.Clear()
    }
    Write-Host 'DEV ready: http://127.0.0.1:5173'
    Write-Host 'Login details: .local/local-runtime-secrets.json (adminUsername/adminPassword). Logs: .local/logs.'
    Write-Host 'Data and credentials persist across restarts. This is a loopback DEV service.'
} finally { Pop-Location }
} finally { $runtimeLock.Dispose() }
