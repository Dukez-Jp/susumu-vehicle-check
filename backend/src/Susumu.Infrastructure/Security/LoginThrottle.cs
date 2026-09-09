using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Susumu.Domain;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Security;

public sealed class LoginThrottleOptions
{
    public const string SectionName = "LoginThrottle";

    /// <summary>Failures for one account before that account is locked out.</summary>
    public int MaxAccountFailures { get; set; } = 5;

    /// <summary>
    /// Failures from one source address before that source is locked out. Deliberately much larger
    /// than the per-account budget: behind a reverse proxy every tablet in the workshop shares one
    /// address, and a single mistyped password must not lock the whole shop out.
    /// </summary>
    public int MaxSourceFailures { get; set; } = 50;

    /// <summary>
    /// Distinct accounts one source may fail against before it is locked out. This is what actually
    /// catches spraying, and it stays useful even when every request shares a proxy address.
    /// </summary>
    public int MaxSourceDistinctAccounts { get; set; } = 12;

    public TimeSpan Window { get; set; } = TimeSpan.FromMinutes(15);

    public void Validate()
    {
        if (MaxAccountFailures < 1 || MaxSourceFailures < 1 || MaxSourceDistinctAccounts < 1)
        {
            throw new InvalidOperationException("LoginThrottle limits must be positive.");
        }

        if (Window <= TimeSpan.Zero)
        {
            throw new InvalidOperationException("LoginThrottle:Window must be positive.");
        }
    }
}

public interface ILoginThrottle
{
    /// <summary>Throws <see cref="TooManyRequestsException"/> when the caller is currently locked out.</summary>
    void EnsureNotBlocked(string username, string clientKey);

    void RegisterFailure(string username, string clientKey);

    void RegisterSuccess(string username, string clientKey);
}

/// <summary>
/// Two independent budgets: one per account and one per source address.
///
/// Behind a reverse proxy every workshop tablet presents the same address, so a shared budget of a
/// handful of failures would let one person with a wrong password lock out the entire workshop. The
/// source budget is therefore wide on raw failures but narrow on the number of *distinct accounts*
/// tried, which is the shape brute-force actually has.
///
/// In-process only: with more than one API instance each instance throttles independently. That is
/// documented in backend/README.md and is acceptable because the account budget, not the source
/// budget, is what protects a single credential.
/// </summary>
public sealed class LoginThrottle(IMemoryCache cache, IClock clock, IOptions<LoginThrottleOptions> options)
    : ILoginThrottle
{
    private readonly LoginThrottleOptions _options = options.Value;

    private sealed class AccountCounter
    {
        public int Failures;
        public DateTimeOffset BlockedUntil;
    }

    private sealed class SourceCounter
    {
        public int Failures;
        public readonly HashSet<string> Accounts = new(StringComparer.Ordinal);
        public DateTimeOffset BlockedUntil;
    }

    public void EnsureNotBlocked(string username, string clientKey)
    {
        var now = clock.UtcNow;

        if (cache.TryGetValue(AccountKey(username), out AccountCounter? account) && account is not null)
        {
            lock (account)
            {
                Reject(account.BlockedUntil - now);
            }
        }

        if (cache.TryGetValue(SourceKey(clientKey), out SourceCounter? source) && source is not null)
        {
            lock (source)
            {
                Reject(source.BlockedUntil - now);
            }
        }
    }

    public void RegisterFailure(string username, string clientKey)
    {
        var now = clock.UtcNow;
        var normalized = username.ToLowerInvariant();

        var account = cache.GetOrCreate(AccountKey(username), entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = _options.Window;
            return new AccountCounter();
        })!;

        lock (account)
        {
            account.Failures++;
            if (account.Failures >= _options.MaxAccountFailures)
            {
                account.BlockedUntil = now.Add(_options.Window);
            }
        }

        var source = cache.GetOrCreate(SourceKey(clientKey), entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = _options.Window;
            return new SourceCounter();
        })!;

        lock (source)
        {
            source.Failures++;
            source.Accounts.Add(normalized);

            if (source.Failures >= _options.MaxSourceFailures ||
                source.Accounts.Count >= _options.MaxSourceDistinctAccounts)
            {
                source.BlockedUntil = now.Add(_options.Window);
            }
        }
    }

    public void RegisterSuccess(string username, string clientKey)
    {
        // Only the account budget is cleared. A shared proxy address keeps its distinct-account
        // memory, so one valid credential cannot be used to reset a spraying counter.
        cache.Remove(AccountKey(username));
    }

    private static void Reject(TimeSpan remaining)
    {
        if (remaining > TimeSpan.Zero)
        {
            throw new TooManyRequestsException("Too many failed sign-in attempts. Try again later.", remaining);
        }
    }

    private static string AccountKey(string username) => $"login-fail:user:{username.ToLowerInvariant()}";

    private static string SourceKey(string clientKey) => $"login-fail:source:{clientKey}";
}
