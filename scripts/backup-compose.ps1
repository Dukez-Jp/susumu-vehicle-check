[CmdletBinding()]
param([string]$Snapshot = ('dev-' + (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')))
$ErrorActionPreference = 'Stop'
if ($Snapshot -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,80}$') { throw 'Snapshot must be a simple new folder name.' }
Push-Location (Split-Path -Parent $PSScriptRoot)
$resumeApi = $false
try {
    $running = & docker compose ps --status running --services
    if ($LASTEXITCODE -ne 0) { throw 'Docker Compose engine unavailable.' }
    $resumeApi = @($running) -contains 'api'
    if ($resumeApi) {
        & docker compose stop --timeout 60 api
        if ($LASTEXITCODE -ne 0) { throw 'API could not be stopped; backup aborted.' }
    }
    & docker compose --profile tools run --rm --build backup backup --photos /photos --output "/backups/$Snapshot" --environment Development --writers-stopped
    if ($LASTEXITCODE -ne 0) { throw 'Backup failed; a folder without sha256.json is incomplete.' }
} finally {
    try {
        if ($resumeApi) {
            & docker compose start api
            if ($LASTEXITCODE -ne 0) { throw 'Backup ended but API restart failed; inspect the service.' }
        }
    } finally { Pop-Location }
}
