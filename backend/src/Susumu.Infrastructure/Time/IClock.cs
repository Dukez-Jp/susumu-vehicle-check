namespace Susumu.Infrastructure.Time;

/// <summary>Always UTC. Injected so token expiry and throttling can be tested deterministically.</summary>
public interface IClock
{
    DateTimeOffset UtcNow { get; }
}

public sealed class SystemClock : IClock
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
