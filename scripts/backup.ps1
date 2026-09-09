[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Photos,
    [Parameter(Mandatory=$true)][string]$OutputDirectory,
    [Parameter(Mandatory=$true)][ValidateSet('Development','Test','RestoreValidation')][string]$Environment,
    [switch]$WritersStopped,
    [string]$PgBin = 'C:\Dev\tools\postgresql18\pgsql\bin'
)
$ErrorActionPreference = 'Stop'
$arguments = @((Join-Path $PSScriptRoot 'backup_restore.py'), 'backup', '--photos', $Photos, '--output', $OutputDirectory, '--environment', $Environment, '--pg-bin', $PgBin)
if ($WritersStopped) { $arguments += '--writers-stopped' }
& python @arguments
if ($LASTEXITCODE -ne 0) { throw 'Backup failed; source data preserved.' }
