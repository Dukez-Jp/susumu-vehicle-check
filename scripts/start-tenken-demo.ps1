[CmdletBinding()]
param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$demoRepo = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $demoRepo 'admin-web'
$privateRoot = Join-Path $demoRepo '.local'
$url = 'http://127.0.0.1:5174/demo.html'
$vite = Join-Path $webRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $vite)) { throw 'Dependencias ausentes. Execute npm.cmd ci na pasta admin-web.' }
New-Item -ItemType Directory -Path $privateRoot -Force | Out-Null
$listening = Get-NetTCPConnection -State Listen -LocalPort 5174 -ErrorAction SilentlyContinue
if (-not $listening) {
    $nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $argsList = @(('"'+$vite+'"'),'--config','vite.demo.config.ts')
    $process = Start-Process -FilePath $nodeExe -ArgumentList $argsList -WorkingDirectory $webRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $privateRoot "tenken-$stamp.out.log") -RedirectStandardError (Join-Path $privateRoot "tenken-$stamp.err.log")
    [pscustomobject]@{ pid=$process.Id; startedAt=$process.StartTime.ToUniversalTime().ToString('o'); url=$url; script=$vite } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $privateRoot 'tenken-demo-process.json') -Encoding UTF8
}
$ready = $false
for ($attempt=0; $attempt -lt 30; $attempt++) {
    try { $response = Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 2; if ($response.Content -match 'Susumu Tenken' -and $response.Content -match '/src/demo/main.tsx') { $ready=$true; break }; throw 'A porta 5174 esta ocupada por outro servico.' }
    catch { if ($listening) { throw }; Start-Sleep -Milliseconds 300 }
}
if (-not $ready) { throw 'A demonstracao nao iniciou. Consulte os logs tenken em .local.' }
Write-Host "Tenken pronto: $url"
if (-not $NoBrowser) {
    $chromePaths = @((Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),(Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),(Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'))
    $chromeExe = $chromePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if (-not $chromeExe) { throw "Chrome nao encontrado. Abra no Chrome: $url" }
    Start-Process -FilePath $chromeExe -ArgumentList $url
}
