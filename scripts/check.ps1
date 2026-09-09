[CmdletBinding()]
param(
    [ValidateSet('All','Backend','Web','Mobile','Infrastructure')][string]$Component = 'All',
    [string]$PortableEnvironment = 'C:\Dev\tools\SUSUMU-env.ps1',
    [switch]$BuildApk
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (Test-Path -LiteralPath $PortableEnvironment) { . $PortableEnvironment }
$repo = Split-Path -Parent $PSScriptRoot
function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}
Push-Location $repo
try {
    if ($Component -in @('All','Infrastructure')) {
        Invoke-Checked 'python' @('-B','-m','unittest','discover','-s','scripts/tests','-v')
        foreach ($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1') {
            $parseTokens = $null
            $parseErrors = $null
            [void][System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$parseTokens, [ref]$parseErrors)
            if ($parseErrors.Count -gt 0) { throw "PowerShell syntax failure in $($file.Name): $parseErrors" }
        }
        $bash = if (Test-Path -LiteralPath 'C:\Program Files\Git\bin\bash.exe') { 'C:\Program Files\Git\bin\bash.exe' } else { 'bash' }
        foreach ($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.sh') {
            Invoke-Checked $bash @('-n', $file.FullName)
        }
        & (Join-Path $PSScriptRoot 'tests\test-local-process-ownership.ps1')
        & (Join-Path $PSScriptRoot 'tests\test-local-private-acl.ps1')
    }
    if ($Component -in @('All','Backend')) {
        Invoke-Checked 'dotnet' @('restore','backend/Susumu.slnx')
        Invoke-Checked 'dotnet' @('build','backend/Susumu.slnx','-c','Release','--no-restore')
        Invoke-Checked 'dotnet' @('test','backend/Susumu.slnx','-c','Release','--no-build','--logger','trx','--results-directory','artifacts/test-results/backend')
    }
    if ($Component -in @('All','Web')) {
        Push-Location 'admin-web'
        try {
            Invoke-Checked 'npm.cmd' @('ci')
            Invoke-Checked 'npm.cmd' @('run','lint')
            Invoke-Checked 'npm.cmd' @('test')
            Invoke-Checked 'npm.cmd' @('run','build')
        } finally { Pop-Location }
    }
    if ($Component -in @('All','Mobile')) {
        Push-Location 'mobile'
        try {
            Invoke-Checked 'flutter' @('pub','get')
            Invoke-Checked 'dart' @('run','build_runner','build','--delete-conflicting-outputs')
            Invoke-Checked 'dart' @('format','--output=none','--set-exit-if-changed','lib','test')
            Invoke-Checked 'flutter' @('analyze','--fatal-infos')
            Invoke-Checked 'flutter' @('test')
            if ($BuildApk) { Invoke-Checked 'flutter' @('build','apk','--debug','--dart-define=ALLOW_HTTP_DEV=true') }
        } finally { Pop-Location }
    }
    Write-Host "$Component checks passed. Only checks selected by this invocation were run."
} finally { Pop-Location }
