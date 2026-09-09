using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace Susumu.Api.Configuration;

public sealed class NetworkOptions
{
    public const string SectionName = "Network";

    /// <summary>
    /// Addresses of reverse proxies whose <c>X-Forwarded-For</c> may be believed, comma separated.
    /// Empty by default: an arbitrary forwarded header is never trusted, because anyone able to
    /// reach the API could otherwise forge a source address and evade the login throttle.
    /// </summary>
    public string TrustedProxies { get; set; } = string.Empty;

    public IReadOnlyList<IPAddress> ParseTrustedProxies()
    {
        if (string.IsNullOrWhiteSpace(TrustedProxies))
        {
            return [];
        }

        var addresses = new List<IPAddress>();
        foreach (var entry in TrustedProxies.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!IPAddress.TryParse(entry, out var address))
            {
                throw new InvalidOperationException(
                    $"Network:TrustedProxies contains '{entry}', which is not an IP address.");
            }

            addresses.Add(address);
        }

        return addresses;
    }
}

public static class ForwardedHeadersSetup
{
    /// <summary>
    /// Enables forwarded headers only for explicitly listed proxies. With no list configured the
    /// middleware is not added at all, so <c>RemoteIpAddress</c> stays the real peer.
    /// </summary>
    public static void AddSusumuForwardedHeaders(this IServiceCollection services, NetworkOptions network)
    {
        var proxies = network.ParseTrustedProxies();
        if (proxies.Count == 0)
        {
            return;
        }

        services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1;
            options.KnownIPNetworks.Clear();
            options.KnownProxies.Clear();

            foreach (var proxy in proxies)
            {
                options.KnownProxies.Add(proxy);
            }
        });
    }
}
