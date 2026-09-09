[CmdletBinding()]
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [switch]$EnvFileOnly
)
# Limit ACL changes to this explicitly selected project's .local tree or .env.
# Never follow junctions/symlinks into another directory.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$rootPath = (Resolve-Path -LiteralPath $Root).ProviderPath
$currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$allowedSids = @($currentSid.Value, 'S-1-5-18', 'S-1-5-32-544')
function Assert-RegularItem([IO.FileSystemInfo]$Item) {
    if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Private storage must not contain a junction or symbolic link: $($Item.FullName)"
    }
}
function Set-PrivateAcl([IO.FileSystemInfo]$Item, [bool]$Protected) {
    # Request/write the DACL only. Set-Acl may attempt owner/audit sections and
    # require SeSecurityPrivilege even when this user's WRITE_DAC is sufficient.
    $acl = $Item.GetAccessControl([Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRuleProtection($Protected, $false)
    foreach ($rule in @($acl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier]))) {
        [void]$acl.RemoveAccessRuleSpecific($rule)
    }
    if ($Protected) {
        $inheritance = if ($Item.PSIsContainer) { [Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit' } else { [Security.AccessControl.InheritanceFlags]::None }
        foreach ($sidValue in $allowedSids) {
            $sid = New-Object Security.Principal.SecurityIdentifier($sidValue)
            $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, [Security.AccessControl.FileSystemRights]::FullControl, $inheritance, [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
            $acl.AddAccessRule($rule)
        }
    }
    $Item.SetAccessControl($acl)
}
function Test-PrivateAcl([IO.FileSystemInfo]$Item) {
    $rules = (Get-Acl -LiteralPath $Item.FullName).GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    if ($rules.Count -lt 3) { return $false }
    foreach ($rule in $rules) {
        if ($rule.IdentityReference.Value -notin $allowedSids -or $rule.AccessControlType -ne 'Allow' -or ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -ne [Security.AccessControl.FileSystemRights]::FullControl) { return $false }
    }
    return $true
}
if ($EnvFileOnly) {
    $envPath = Join-Path $rootPath '.env'
    $item = Get-Item -Force -LiteralPath $envPath
    if ($item.PSIsContainer) { throw '.env must be a regular file.' }
    Assert-RegularItem $item
    Set-PrivateAcl $item $true
    if (-not (Test-PrivateAcl $item)) { throw 'Private .env ACL verification failed; no secrets may be written.' }
} else {
    $privatePath = Join-Path $rootPath '.local'
    if (-not (Test-Path -LiteralPath $privatePath)) { [void](New-Item -ItemType Directory -Path $privatePath) }
    $private = Get-Item -Force -LiteralPath $privatePath
    if (-not $private.PSIsContainer) { throw '.local must be a regular directory.' }
    Assert-RegularItem $private
    $items = New-Object 'Collections.Generic.List[IO.FileSystemInfo]'
    $queue = New-Object 'Collections.Generic.Queue[string]'
    $queue.Enqueue($privatePath)
    while ($queue.Count -gt 0) {
        foreach ($item in Get-ChildItem -Force -LiteralPath $queue.Dequeue()) {
            Assert-RegularItem $item
            $items.Add($item)
            if ($item.PSIsContainer) { $queue.Enqueue($item.FullName) }
        }
    }
    Set-PrivateAcl $private $true
    # Normally Windows propagates the protected parent ACL automatically. Repair
    # pre-existing explicit/protected child rules too; preserve file contents.
    foreach ($item in $items) {
        if ((Test-Path -LiteralPath $item.FullName) -and -not (Test-PrivateAcl $item)) { Set-PrivateAcl $item $false }
    }
    foreach ($item in @($private) + $items.ToArray()) {
        if ((Test-Path -LiteralPath $item.FullName) -and -not (Test-PrivateAcl $item)) { throw "Private ACL verification failed: $($item.FullName)" }
    }
}
