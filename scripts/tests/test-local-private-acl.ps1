$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$scriptsPath = Split-Path -Parent $PSScriptRoot
$repo = Split-Path -Parent $scriptsPath
$fixtureRoot = Join-Path $repo ('.local\acl-validation-' + [Guid]::NewGuid().ToString('N'))
$private = Join-Path $fixtureRoot '.local'
$nested = Join-Path $private 'nested'
[void](New-Item -ItemType Directory -Path $nested -Force)
$existing = Join-Path $nested 'existing-synthetic.txt'
[IO.File]::WriteAllText($existing, 'synthetic ACL test data; no credentials')
# Reproduce a previously protected file with an explicit broad read grant.
$item = Get-Item -LiteralPath $existing
$acl = $item.GetAccessControl([Security.AccessControl.AccessControlSections]::Access)
$acl.SetAccessRuleProtection($true, $true)
$broadRule = New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier('S-1-5-32-545')), [Security.AccessControl.FileSystemRights]::Read, [Security.AccessControl.AccessControlType]::Allow)
$acl.AddAccessRule($broadRule)
$item.SetAccessControl($acl)
& python -B (Join-Path $scriptsPath 'generate_dev_env.py') --root $fixtureRoot
if ($LASTEXITCODE -ne 0) { throw 'Windows DEV secret generation failed.' }
$newFile = Join-Path $nested 'new-synthetic.txt'
[IO.File]::WriteAllText($newFile, 'synthetic newly inherited file')
$allowed = @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'S-1-5-18', 'S-1-5-32-544')
foreach ($path in @($private, $existing, $newFile, (Join-Path $private 'dev-credentials.json'), (Join-Path $fixtureRoot '.env'))) {
    $rules = (Get-Acl -LiteralPath $path).GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    if ($rules.Count -lt 3) { throw "Missing private access rules: $path" }
    foreach ($rule in $rules) {
        if ($rule.IdentityReference.Value -notin $allowed -or $rule.AccessControlType -ne 'Allow') { throw "Unexpected account access in private fixture: $path" }
    }
}
if (-not (Get-Acl -LiteralPath $private).AreAccessRulesProtected) { throw 'Private directory must reject broad parent inheritance.' }
if ((Get-Acl -LiteralPath $existing).AreAccessRulesProtected -or (Get-Acl -LiteralPath $newFile).AreAccessRulesProtected) { throw 'Child files must inherit the private directory ACL.' }
if ([IO.File]::ReadAllText($existing) -ne 'synthetic ACL test data; no credentials') { throw 'Existing file content changed during ACL repair.' }
Write-Host 'Windows private ACL: repaired existing broad access; new files and .env permit current SID, SYSTEM and Administrators only.'
