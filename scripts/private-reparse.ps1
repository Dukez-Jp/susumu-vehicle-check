# Inspect the tag without following the reparse point. OneDrive placeholders are
# not directory redirects: allow only Microsoft's CLOUD family, never junctions.
# https://learn.microsoft.com/windows/win32/api/winbase/ns-winbase-file_attribute_tag_info
if (-not ('SusumuPrivateReparse' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class SusumuPrivateReparse {
    [StructLayout(LayoutKind.Sequential)]
    private struct AttributeTag { public uint Attributes; public uint Tag; }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    private static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint disposition, uint flags, IntPtr template);
    [DllImport("kernel32.dll", SetLastError=true)]
    private static extern bool GetFileInformationByHandleEx(SafeFileHandle handle, int infoClass, out AttributeTag info, uint size);
    public static uint ReadTag(string path) {
        if(!path.StartsWith(@"\\?\")) {
            path=System.IO.Path.GetFullPath(path);
            path=path.StartsWith(@"\\") ? @"\\?\UNC\"+path.Substring(2) : @"\\?\"+path;
        }
        using (var handle=CreateFile(path,0,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero)) {
            if(handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
            AttributeTag info;
            if(!GetFileInformationByHandleEx(handle,9,out info,8)) throw new Win32Exception(Marshal.GetLastWin32Error());
            return info.Tag;
        }
    }
    public static bool IsCloud(uint tag) { return (tag & 0xFFFF0FFFu)==0x9000001Au; }
}
'@
}
