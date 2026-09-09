using Susumu.Domain;

namespace Susumu.Infrastructure.Services;

/// <summary>
/// Shared bounds for the paged list endpoints. Out-of-range values are rejected rather than clamped,
/// so a client that pages incorrectly finds out instead of silently reading the wrong window.
/// </summary>
public static class Paging
{
    public const int DefaultLimit = 100;
    public const int MaxLimit = 500;

    public static (int Offset, int Limit) Validate(int? offset, int? limit, int maxLimit = MaxLimit)
    {
        var errors = new Dictionary<string, string[]>();

        var resolvedOffset = offset ?? 0;
        if (resolvedOffset < 0)
        {
            errors["offset"] = ["Must be zero or greater."];
        }

        var resolvedLimit = limit ?? Math.Min(DefaultLimit, maxLimit);
        if (resolvedLimit < 1 || resolvedLimit > maxLimit)
        {
            errors["limit"] = [$"Must be between 1 and {maxLimit}."];
        }

        if (errors.Count > 0)
        {
            throw AppException.Validation("Invalid paging parameters.", errors);
        }

        return (resolvedOffset, resolvedLimit);
    }
}
