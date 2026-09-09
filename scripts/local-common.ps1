# Shared helpers for the project-owned native Windows DEV runtime.
Set-StrictMode -Version Latest
function Get-SusumuRepoRoot { return (Split-Path -Parent $PSScriptRoot) }
function Get-SusumuPrivateDirectory {
    $directory = Join-Path (Get-SusumuRepoRoot) '.local'
    if (-not (Get-Variable -Scope Script -Name SusumuPrivateAclChecked -ErrorAction SilentlyContinue)) {
        & (Join-Path $PSScriptRoot 'protect-private-paths.ps1') -Root (Get-SusumuRepoRoot)
        $script:SusumuPrivateAclChecked = $true
    }
    return $directory
}
function Get-SusumuRuntimeLock([string]$Path = (Join-Path (Get-SusumuPrivateDirectory) 'local-runtime.lock')) {
    try { return [IO.File]::Open($Path, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch [IO.IOException] { throw 'Another local runtime command is active; no service was changed.' }
}
function Write-SusumuJson([string]$Path, [object]$Value, [switch]$Exclusive) {
    $content = ($Value | ConvertTo-Json -Depth 8) + [Environment]::NewLine
    $mode = if ($Exclusive) { [IO.FileMode]::CreateNew } else { [IO.FileMode]::Create }
    $stream = [IO.File]::Open($Path, $mode, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $bytes = (New-Object Text.UTF8Encoding($false)).GetBytes($content)
        $stream.Write($bytes, 0, $bytes.Length)
    } finally { $stream.Dispose() }
}
function New-SusumuSecret([int]$Bytes = 48) {
    $buffer = New-Object byte[] $Bytes
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($buffer) } finally { $random.Dispose() }
    return ([BitConverter]::ToString($buffer)).Replace('-', '').ToLowerInvariant()
}
function Get-SusumuRuntimeSecrets {
    $path = Join-Path (Get-SusumuPrivateDirectory) 'local-runtime-secrets.json'
    if (-not (Test-Path -LiteralPath $path)) {
        $secrets = [ordered]@{
            environment = 'Development'
            adminUsername = 'admin'
            adminPassword = New-SusumuSecret 24
            jwtSigningKey = New-SusumuSecret 48
        }
        try { Write-SusumuJson $path $secrets -Exclusive }
        catch [IO.IOException] { if (-not (Test-Path -LiteralPath $path)) { throw } }
    }
    $saved = Get-Content -Raw -LiteralPath $path | ConvertFrom-Json
    if ($saved.environment -ne 'Development' -or $saved.adminUsername -ne 'admin' -or $saved.adminPassword.Length -lt 32 -or $saved.jwtSigningKey.Length -lt 64) {
        throw 'Invalid local runtime secret file. Existing values were preserved; inspect the private file.'
    }
    return $saved
}
function Get-SusumuState {
    $path = Join-Path (Get-SusumuPrivateDirectory) 'local-processes.json'
    if (Test-Path -LiteralPath $path) { return Get-Content -Raw -LiteralPath $path | ConvertFrom-Json }
    return [pscustomobject]@{ version = 1; repository = Get-SusumuRepoRoot; api = $null; web = $null; database = $null }
}
function Save-SusumuState([object]$State) {
    Write-SusumuJson (Join-Path (Get-SusumuPrivateDirectory) 'local-processes.json') $State
}
function Test-SusumuPort([int]$Port) {
    $client = New-Object Net.Sockets.TcpClient
    try {
        $pending = $client.ConnectAsync('127.0.0.1', $Port)
        return ($pending.Wait(400) -and $client.Connected)
    } catch { return $false } finally { $client.Dispose() }
}
function Get-SusumuProcessRecord([Diagnostics.Process]$Process, [string]$Kind, [string]$Executable, [string]$Marker) {
    $Process.Refresh()
    return [pscustomobject]@{
        kind = $Kind; pid = $Process.Id; startTimeUtcTicks = $Process.StartTime.ToUniversalTime().Ticks.ToString()
        executable = [IO.Path]::GetFullPath($Executable); marker = $Marker; startedByScript = $true
    }
}
function Get-SusumuOwnedProcess([object]$Record, [string]$Kind, [string]$ExpectedMarker) {
    if ($null -eq $Record -or -not $Record.startedByScript -or $Record.kind -ne $Kind -or $Record.marker -ne $ExpectedMarker) { return $null }
    $process = $null
    $accepted = $false
    try {
        $process = Get-Process -Id ([int]$Record.pid) -ErrorAction Stop
        # Force the native handle to open BEFORE validation. Keep this same
        # Process/handle through Kill; never resolve its PID again for stopping.
        [void]$process.Handle
        $details = Get-CimInstance Win32_Process -Filter ("ProcessId = " + [int]$Record.pid)
        if ($process.StartTime.ToUniversalTime().Ticks.ToString() -ne $Record.startTimeUtcTicks) { return $null }
        if (-not [string]::Equals($details.ExecutablePath, $Record.executable, [StringComparison]::OrdinalIgnoreCase)) { return $null }
        $allowedName = if ($Kind -eq 'api') { 'dotnet.exe' } elseif ($Kind -eq 'web') { 'node.exe' } else { 'postgres.exe' }
        if ([IO.Path]::GetFileName($details.ExecutablePath) -ne $allowedName) { return $null }
        if (-not $details.CommandLine.Replace('/', '\').ToLowerInvariant().Contains($ExpectedMarker.Replace('/', '\').ToLowerInvariant())) { return $null }
        $accepted = $true
        return $process
    } catch { return $null }
    finally { if (-not $accepted -and $null -ne $process) { $process.Dispose() } }
}
function Test-SusumuOwnedProcess([object]$Record, [string]$Kind, [string]$ExpectedMarker) {
    $process = Get-SusumuOwnedProcess $Record $Kind $ExpectedMarker
    if ($null -eq $process) { return $false }
    $process.Dispose()
    return $true
}
function Stop-SusumuOwnedProcess([object]$Record, [string]$Kind, [string]$ExpectedMarker) {
    $process = Get-SusumuOwnedProcess $Record $Kind $ExpectedMarker
    if ($null -ne $process) {
        try {
            if (-not $process.HasExited) { $process.Kill() }
            if (-not $process.WaitForExit(10000)) { throw "Owned $Kind process did not exit." }
            Write-Host "Stopped project-owned $Kind process."
            return $true
        } finally { $process.Dispose() }
    }
    if ($null -ne $Record) { Write-Host "Preserved ${Kind}: recorded process is absent, reused, or no longer matches ownership checks." }
    return $false
}
function Wait-SusumuHttp([string]$Url, [int]$Seconds = 90) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    throw "DEV service readiness failed at $Url. Inspect .local/logs; existing data was preserved."
}
