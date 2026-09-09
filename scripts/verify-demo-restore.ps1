[CmdletBinding()]
param(
    [switch]$WritersStopped,
    [switch]$PlanOnly,
    [string]$PgBin = 'C:\Dev\tools\postgresql18\pgsql\bin',
    [string]$PhotosPath
)
# Native Windows DEV validation only. This script never stops services, drops a
# database, removes files, changes the running API configuration, or prints secrets.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'local-common.ps1')
$repo = [IO.Path]::GetFullPath((Get-SusumuRepoRoot))
$private = Join-Path $repo '.local'
if (-not $PhotosPath) { $PhotosPath = Join-Path $private 'photo-storage' }
$photos = [IO.Path]::GetFullPath($PhotosPath)
$privatePrefix = $private.TrimEnd('\') + '\'
if (-not $photos.StartsWith($privatePrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Photo source must be an explicit directory beneath this project .local; no external storage is touched.'
}
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')
$targetDatabase = 'susumu_restore_' + $stamp
$runRoot = Join-Path $private ('demo-restore-' + $stamp)
$bundle = Join-Path $runRoot 'bundle'
$restoredPhotos = Join-Path $runRoot 'restored-photos'
$reportPath = Join-Path $runRoot 'verification.json'
$psql = Join-Path $PgBin 'psql.exe'
if ($PlanOnly) {
    Write-Host 'PLAN ONLY: no database access, service stop, backup or restore was performed.'
    Write-Host 'Source: loopback 127.0.0.1:55432 / susumu_dev; password is read privately at execution.'
    Write-Host "Photo source: $photos"
    Write-Host "A real run generates a new timestamp. Example target: $targetDatabase"
    Write-Host "Example evidence directory: $runRoot"
    Write-Host 'Before execution: finish end-to-end testing, stop every writer, keep them stopped until verification completes, then pass -WritersStopped.'
    return
}
if (-not $WritersStopped) { throw 'No work performed. Stop all API/background writers first, then pass -WritersStopped.' }

function Assert-WritersStopped {
    foreach ($port in @(5080, 5085)) {
        if (Test-SusumuPort $port) { throw "Port $port is still listening. No service was stopped; stop the API/writers before this validation." }
    }
    $runningApi = @(Get-CimInstance Win32_Process -Filter "Name = 'dotnet.exe'" | Where-Object {
        $_.CommandLine -and $_.CommandLine.IndexOf('Susumu.Api.dll', [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
        $_.CommandLine.IndexOf($repo, [StringComparison]::OrdinalIgnoreCase) -ge 0
    })
    if ($runningApi.Count) { throw 'A project API process is still running. Stop all writers explicitly; this script never terminates processes.' }
}

function Read-DatabaseJson([string]$Database, [string]$Sql) {
    if ($Database -ne 'susumu_dev' -and $Database -notmatch '^susumu_restore_[0-9]{17}$') { throw 'Unexpected database target refused.' }
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $psql
    $start.Arguments = '-X --no-password -qAt -v ON_ERROR_STOP=1 -d ' + $Database
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    # Read queries cannot mutate either database, even if the SQL below is edited accidentally.
    $start.EnvironmentVariables['PGOPTIONS'] = '-c default_transaction_read_only=on'
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $start
    try {
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        $process.StandardInput.WriteLine($Sql)
        $process.StandardInput.Close()
        if (-not $process.WaitForExit(60000)) { $process.Kill(); throw 'Read-only database snapshot timed out.' }
        $output = $stdout.GetAwaiter().GetResult().Trim()
        [void]$stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw 'Database snapshot failed; verify schema and local PostgreSQL access. Connection diagnostics were not printed.' }
        return $output
    } finally { $process.Dispose() }
}

function Get-DatabaseSnapshot([string]$Database) {
    $sql = @'
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT jsonb_build_object(
  'otherClients', (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND backend_type = 'client backend'),
  'counts', jsonb_build_object(
    'inspections', (SELECT count(*) FROM inspections),
    'finalizedInspections', (SELECT count(*) FROM inspections WHERE "State" = 'Finalized'),
    'inspectionItems', (SELECT count(*) FROM inspection_items),
    'photos', (SELECT count(*) FROM photos),
    'uploadedPhotos', (SELECT count(*) FROM photos WHERE "Uploaded"),
    'pendingPhotos', (SELECT count(*) FROM photos WHERE NOT "Uploaded"),
    'auditRows', (SELECT count(*) FROM audit_log),
    'syncReceipts', (SELECT count(*) FROM sync_operations)),
  'inspections', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i."Id") FROM inspections i), '[]'::jsonb),
  'items', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i."Id") FROM inspection_items i), '[]'::jsonb),
  'photos', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p."Id") FROM photos p), '[]'::jsonb)
);
COMMIT;
'@
    $raw = Read-DatabaseJson $Database $sql
    $data = $raw | ConvertFrom-Json
    if ($data.otherClients -ne 0) { throw 'Another client is connected to the demonstration/restore database; preserve the writer-stop barrier and retry later.' }
    return [pscustomobject]@{ Raw = $raw; Data = $data }
}

function Get-PhotoManifest([string]$Root) {
    $rootItem = Get-Item -Force -LiteralPath $Root
    if (-not $rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Photo root must be a real directory, never a link.' }
    $prefix = [IO.Path]::GetFullPath($Root).TrimEnd('\') + '\'
    $queue = New-Object 'Collections.Generic.Queue[string]'
    $queue.Enqueue($Root)
    $files = New-Object 'Collections.Generic.List[object]'
    while ($queue.Count) {
        foreach ($item in Get-ChildItem -Force -LiteralPath ($queue.Dequeue())) {
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'A photo directory contains a link; verification refused without following it.' }
            if ($item.PSIsContainer) { $queue.Enqueue($item.FullName); continue }
            if (-not $item.FullName.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'A photo path escaped its root.' }
            $files.Add([pscustomobject][ordered]@{
                path = $item.FullName.Substring($prefix.Length).Replace('\', '/')
                sizeBytes = $item.Length
                sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $item.FullName).Hash.ToLowerInvariant()
            })
        }
    }
    return @($files | Sort-Object path)
}

function Assert-UploadedPhotoBytes([object]$Snapshot, [object[]]$Manifest) {
    $byPath = @{}
    foreach ($file in $Manifest) { $byPath[$file.path] = $file }
    foreach ($photo in $Snapshot.photos) {
        if (-not $photo.Uploaded) { continue }
        $relative = [string]$photo.StoragePath
        $parts = $relative.Replace('\', '/').Split('/')
        if ([string]::IsNullOrWhiteSpace($relative) -or [IO.Path]::IsPathRooted($relative) -or $relative.Contains(':') -or $parts -contains '..') {
            throw 'Uploaded photo metadata contains an unsafe storage path.'
        }
        $file = $byPath[$relative.Replace('\', '/')]
        if ($null -eq $file -or $file.sizeBytes -ne $photo.SizeBytes -or $file.sha256 -ne $photo.Sha256) {
            throw "Uploaded photo $($photo.Id) is missing or its stored length/SHA-256 does not match the bytes."
        }
    }
}

Assert-WritersStopped
if (-not (Test-Path -LiteralPath $psql)) { throw 'Portable PostgreSQL 18 client tools are missing.' }
if (-not (Test-Path -LiteralPath $photos -PathType Container)) { throw 'Demo photo directory is missing; complete the end-to-end upload test first.' }
$passwordPath = Join-Path $private 'postgres\password.txt'
if (-not (Test-Path -LiteralPath $passwordPath)) { throw 'Managed DEV PostgreSQL password file is missing.' }
# Applies existing private ACL guard before any evidence (or process secret) is created/read.
[void](Get-SusumuPrivateDirectory)
$runtimeLock = Get-SusumuRuntimeLock
$variables = @{}
$previous = @{}
try {
    $variables = @{
        PGHOST = '127.0.0.1'; PGHOSTADDR = '127.0.0.1'; PGPORT = '55432'
        PGUSER = 'susumu_dev'; PGDATABASE = 'susumu_dev'; PGCONNECT_TIMEOUT = '10'
        PGAPPNAME = 'susumu-demo-restore-validation'; PGSSLMODE = 'disable'
        PGSERVICE = $null; PGSERVICEFILE = $null; PGOPTIONS = $null
        PGPASSWORD = [IO.File]::ReadAllText($passwordPath).Trim()
    }
    foreach ($key in $variables.Keys) {
        $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        [Environment]::SetEnvironmentVariable($key, $variables[$key], 'Process')
    }
    Assert-WritersStopped
    if (Test-Path -LiteralPath $runRoot) { throw 'Validation output already exists; rerun for a new timestamp. Existing evidence was preserved.' }
    $source = Get-DatabaseSnapshot 'susumu_dev'
    if ($source.Data.counts.finalizedInspections -lt 1 -or $source.Data.counts.inspectionItems -lt 1 -or $source.Data.counts.uploadedPhotos -lt 1) {
        throw 'Complete an end-to-end finalized inspection with uploaded photo bytes first; an empty restore drill is not accepted.'
    }
    $sourceFiles = @(Get-PhotoManifest $photos)
    Assert-UploadedPhotoBytes $source.Data $sourceFiles
    [void](New-Item -ItemType Directory -Path $runRoot)
    [IO.File]::WriteAllText((Join-Path $runRoot 'source-database.json'), $source.Raw, (New-Object Text.UTF8Encoding($false)))
    Write-SusumuJson (Join-Path $runRoot 'source-photo-sha256.json') $sourceFiles -Exclusive
    Write-Host 'Creating the DEV backup and restoring into new isolated targets. Keep all writers stopped until verification completes.'
    & (Join-Path $PSScriptRoot 'backup.ps1') -Photos $photos -OutputDirectory $bundle -Environment Development -WritersStopped -PgBin $PgBin | Out-Null
    & (Join-Path $PSScriptRoot 'restore.ps1') -Bundle $bundle -TargetDatabase $targetDatabase -TargetPhotos $restoredPhotos -Environment RestoreValidation -PgBin $PgBin | Out-Null
    Assert-WritersStopped
    $restored = Get-DatabaseSnapshot $targetDatabase
    $restoredFiles = @(Get-PhotoManifest $restoredPhotos)
    Assert-UploadedPhotoBytes $restored.Data $restoredFiles
    [IO.File]::WriteAllText((Join-Path $runRoot 'restored-database.json'), $restored.Raw, (New-Object Text.UTF8Encoding($false)))
    Write-SusumuJson (Join-Path $runRoot 'restored-photo-sha256.json') $restoredFiles -Exclusive
    if ($source.Raw -cne $restored.Raw) { throw 'Restored database counts or inspection/item/photo records differ; isolated targets and evidence were preserved.' }
    if (($sourceFiles | ConvertTo-Json -Depth 5 -Compress) -cne ($restoredFiles | ConvertTo-Json -Depth 5 -Compress)) { throw 'Restored photo paths, lengths or SHA-256 values differ.' }
    # Detect a violated stop barrier while the backup/restore was in progress.
    $sourceAfter = Get-DatabaseSnapshot 'susumu_dev'
    $sourceFilesAfter = @(Get-PhotoManifest $photos)
    if ($source.Raw -cne $sourceAfter.Raw -or ($sourceFiles | ConvertTo-Json -Depth 5 -Compress) -cne ($sourceFilesAfter | ConvertTo-Json -Depth 5 -Compress)) {
        throw 'Demo data changed during verification. The writer-stop barrier was violated; do not mark this drill successful.'
    }
    $evidenceHashes = [ordered]@{}
    foreach ($name in @('source-database.json', 'restored-database.json', 'source-photo-sha256.json', 'restored-photo-sha256.json')) {
        $evidenceHashes[$name] = (Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $runRoot $name)).Hash.ToLowerInvariant()
    }
    Write-SusumuJson $reportPath ([ordered]@{
        verifiedAt = [DateTime]::UtcNow.ToString('o'); environment = 'RestoreValidation'
        sourceDatabase = 'susumu_dev'; targetDatabase = $targetDatabase
        sourcePhotos = $photos; restoredPhotos = $restoredPhotos; bundle = $bundle
        counts = $source.Data.counts; photoFileCount = $sourceFiles.Count
        allUploadedMetadataMatchesBytes = $true; databaseRecordsMatch = $true
        photoPathsLengthsAndSha256Match = $true; sourceUnchanged = $true
        sha256 = $evidenceHashes
    }) -Exclusive
    Write-Host "Verified new restore database: $targetDatabase"
    Write-Host "Counts: inspections=$($source.Data.counts.inspections), items=$($source.Data.counts.inspectionItems), photos=$($source.Data.counts.photos), uploaded=$($source.Data.counts.uploadedPhotos), pending=$($source.Data.counts.pendingPhotos)."
    Write-Host "Photo files checked by length and SHA-256: $($sourceFiles.Count). Evidence: $reportPath"
    Write-Host 'All source data was preserved. Writers may now resume; no service was started by this script.'
} finally {
    foreach ($key in $previous.Keys) { [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process') }
    $variables.Clear()
    $runtimeLock.Dispose()
}
