$ErrorActionPreference='Stop'
$scripts=Split-Path -Parent $PSScriptRoot
. (Join-Path $scripts 'private-reparse.ps1')
foreach($tag in @([uint32]2415919130,[uint32]2415923226,[uint32]2415980570)) {
    if(-not [SusumuPrivateReparse]::IsCloud($tag)){throw 'Expected CLOUD tag rejected'}
}
foreach($tag in @([uint32]2684354563,[uint32]2684354572,[uint32]2147483659,[uint32]2415984666,[uint32]0)) {
    if([SusumuPrivateReparse]::IsCloud($tag)){throw 'Redirect or unknown tag accepted'}
}
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('susumu-relocation-acl-test-'+[guid]::NewGuid().ToString('N'))
$private=Join-Path $fixture '.local'
$outside=Join-Path $fixture 'outside'
New-Item -ItemType Directory -Path $private,$outside -Force | Out-Null
$sentinel=Join-Path $outside 'sentinel.txt'
[IO.File]::WriteAllText($sentinel,'preserve this external fixture')
$before=(Get-Acl -LiteralPath $sentinel).Sddl
$link=Join-Path $private 'blocked-junction'
try {
New-Item -ItemType Junction -Path $link -Target $outside | Out-Null
$rejected=$false
try { & (Join-Path $scripts 'protect-private-paths.ps1') -Root $fixture } catch { $rejected=$_.Exception.Message -like '*must not contain*' }
if(-not $rejected){throw 'A real junction was not blocked'}
if((Get-Acl -LiteralPath $sentinel).Sddl -ne $before){throw 'External ACL was modified through junction'}
# Delete only the fixture junction itself, never recurse into its target.
if((Get-Item -LiteralPath $link).LinkType -ne 'Junction'){throw 'Expected fixture junction'}
[IO.Directory]::Delete($link)
& (Join-Path $scripts 'protect-private-paths.ps1') -Root $fixture
if([IO.File]::ReadAllText($sentinel) -ne 'preserve this external fixture'){throw 'Sentinel content changed'}
Write-Output 'OneDrive private paths: CLOUD tags accepted; junction/symlink/unknown tags rejected; actual junction blocked without changing target ACL.'
} finally {
    # Always unlink the fixture redirect before recursively removing its root.
    # This unique temp directory was created by this test, outside real .local.
    if (Test-Path -LiteralPath $link) {
        if ((Get-Item -LiteralPath $link).LinkType -ne 'Junction') { throw 'Unexpected fixture replacement; preserved' }
        [IO.Directory]::Delete($link)
    }
    $resolvedFixture=(Resolve-Path -LiteralPath $fixture).ProviderPath
    $tempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
    if (-not $resolvedFixture.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase) -or
        [IO.Path]::GetFileName($resolvedFixture) -notmatch '^susumu-relocation-acl-test-[0-9a-f]{32}$') {
        throw 'Unexpected fixture cleanup target; preserved'
    }
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}
