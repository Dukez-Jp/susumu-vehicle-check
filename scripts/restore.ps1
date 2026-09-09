[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Bundle,
    [Parameter(Mandatory=$true)][string]$TargetDatabase,
    [Parameter(Mandatory=$true)][string]$TargetPhotos,
    [Parameter(Mandatory=$true)][ValidateSet('Development','Test','RestoreValidation')][string]$Environment,
    [string]$PgBin = 'C:\Dev\tools\postgresql18\pgsql\bin'
)
$ErrorActionPreference = 'Stop'
& python (Join-Path $PSScriptRoot 'backup_restore.py') restore --bundle $Bundle --target-database $TargetDatabase --target-photos $TargetPhotos --environment $Environment --pg-bin $PgBin
if ($LASTEXITCODE -ne 0) { throw 'Restore failed; no existing database or photo directory was overwritten.' }
