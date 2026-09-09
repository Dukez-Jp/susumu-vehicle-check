namespace Susumu.Infrastructure.Seed;

/// <summary>
/// Deterministic identifiers for the DEV fixture. Fixed values keep the seed idempotent and let the
/// mobile and web workers reference the same synthetic records without a bootstrap call.
/// </summary>
public static class SeedIds
{
    public const int GroupCompany = 1;
    public const int GroupLocation = 2;
    public const int GroupUser = 3;
    public const int GroupVehicle = 4;
    public const int GroupTemplate = 5;
    public const int GroupSection = 6;
    public const int GroupItem = 7;

    public static Guid Of(int group, int index)
    {
        Span<byte> bytes = stackalloc byte[16];
        bytes.Clear();
        bytes[0] = 0x5E;
        bytes[1] = 0xED;
        bytes[2] = 0xDE;
        bytes[3] = 0x71;
        BitConverter.TryWriteBytes(bytes[4..8], group);
        BitConverter.TryWriteBytes(bytes[8..12], index);
        return new Guid(bytes);
    }

    public static Guid Company => Of(GroupCompany, 1);

    public static Guid Location => Of(GroupLocation, 1);

    /// <summary>Synthetic truck "714" used by the first vertical slice.</summary>
    public static Guid Vehicle714 => Of(GroupVehicle, 714);
}
