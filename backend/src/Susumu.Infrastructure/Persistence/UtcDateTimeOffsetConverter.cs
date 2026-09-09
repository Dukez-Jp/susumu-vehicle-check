using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Susumu.Infrastructure.Persistence;

/// <summary>
/// Persists every timestamp as its UTC instant.
///
/// The domain works in <see cref="DateTimeOffset"/> because the contract exchanges ISO-8601 UTC
/// values, but SQLite cannot ORDER BY that type, which would make the fast test provider diverge
/// from PostgreSQL exactly on the ordered history and audit queries. Storing the instant gives one
/// representation that PostgreSQL maps to <c>timestamp with time zone</c> and SQLite sorts correctly.
/// </summary>
public sealed class UtcDateTimeOffsetConverter : ValueConverter<DateTimeOffset, DateTime>
{
    public UtcDateTimeOffsetConverter()
        : base(
            value => value.UtcDateTime,
            value => new DateTimeOffset(DateTime.SpecifyKind(value, DateTimeKind.Utc), TimeSpan.Zero))
    {
    }
}
