$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'local-common.ps1')
$lockPath = Join-Path (Get-SusumuPrivateDirectory) 'process-ownership-test.lock'
$firstLock = Get-SusumuRuntimeLock $lockPath
try {
    $secondLock = $null
    try { $secondLock = Get-SusumuRuntimeLock $lockPath } catch { }
    if ($null -ne $secondLock) { $secondLock.Dispose(); throw 'Concurrent runtime operation acquired an exclusive lock.' }
} finally { $firstLock.Dispose() }
$fixtureMarker = 'susumu-process-ownership-fixture-' + [Guid]::NewGuid().ToString('N')
$nodePath = (Get-Command node -ErrorAction Stop).Source
$owned = Start-Process -FilePath $nodePath -ArgumentList @('-e','"setInterval(()=>{},1000)"',$fixtureMarker) -WindowStyle Hidden -PassThru
try {
    Start-Sleep -Milliseconds 250
    $record = Get-SusumuProcessRecord $owned 'web' $nodePath $fixtureMarker
    if (-not (Test-SusumuOwnedProcess $record 'web' $fixtureMarker)) { throw 'Real owned process must match.' }
    if (Test-SusumuOwnedProcess $record 'web' 'another-project-marker') { throw 'Wrong project marker was accepted.' }
    $realTicks = $record.startTimeUtcTicks
    $record.startTimeUtcTicks = '0'
    if (Test-SusumuOwnedProcess $record 'web' $fixtureMarker) { throw 'Reused PID/start-time mismatch was accepted.' }
    $record.startTimeUtcTicks = $realTicks
    $record.startedByScript = $false
    if (Test-SusumuOwnedProcess $record 'web' $fixtureMarker) { throw 'Unowned/reused process was accepted.' }
    $record.startedByScript = $true
    if (-not (Stop-SusumuOwnedProcess $record 'web' $fixtureMarker)) { throw 'Owned fixture process could not be stopped.' }
    if (-not $owned.WaitForExit(5000)) { throw 'Owned fixture did not exit.' }
    Write-Host 'Windows process ownership: exact process accepted; wrong project, reused PID and unowned process rejected.'
} finally {
    # This Process object is the harmless child created above, never a looked-up unrelated PID.
    if (-not $owned.HasExited) { $owned.Kill() }
    $owned.Dispose()
}

# Deterministically simulate the PID lookup changing immediately AFTER the
# original process has been validated. Termination must use its retained handle.
$script:originalOwnershipLookup = (Get-Item Function:Get-SusumuOwnedProcess).ScriptBlock
$raceMarker = 'susumu-handle-race-fixture-' + [Guid]::NewGuid().ToString('N')
$originalFixture = Start-Process -FilePath $nodePath -ArgumentList @('-e','"setInterval(()=>{},1000)"',$raceMarker) -WindowStyle Hidden -PassThru
$script:replacementFixture = Start-Process -FilePath $nodePath -ArgumentList @('-e','"setInterval(()=>{},1000)"',($raceMarker + '-replacement')) -WindowStyle Hidden -PassThru
try {
    Start-Sleep -Milliseconds 250
    $raceRecord = Get-SusumuProcessRecord $originalFixture 'web' $nodePath $raceMarker
    function Get-SusumuOwnedProcess([object]$Record, [string]$Kind, [string]$ExpectedMarker) {
        $retained = & $script:originalOwnershipLookup $Record $Kind $ExpectedMarker
        if ($null -eq $retained) { throw 'Race fixture could not be validated.' }
        # A fresh PID lookup after this point would target the replacement.
        $Record.pid = $script:replacementFixture.Id
        return $retained
    }
    if (-not (Stop-SusumuOwnedProcess $raceRecord 'web' $raceMarker)) { throw 'Original race fixture was not stopped.' }
    if (-not $originalFixture.WaitForExit(5000)) { throw 'Validated original remains running.' }
    if ($script:replacementFixture.HasExited) { throw 'Replacement process was wrongly stopped after identity changed.' }
    Write-Host 'Windows stop race: identity changed after validation; original handle stopped and replacement stayed alive.'
} finally {
    Set-Item Function:Get-SusumuOwnedProcess -Value $script:originalOwnershipLookup
    foreach ($fixture in @($originalFixture, $script:replacementFixture)) {
        if (-not $fixture.HasExited) { $fixture.Kill(); [void]$fixture.WaitForExit(5000) }
        $fixture.Dispose()
    }
}
