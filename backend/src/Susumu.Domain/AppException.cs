using System.Net;

namespace Susumu.Domain;

/// <summary>
/// Business/authorization failure that maps directly onto a ProblemDetails response.
/// Anything not represented here surfaces as 500 and must be treated as a bug.
/// </summary>
public class AppException : Exception
{
    public AppException(HttpStatusCode status, string title, string detail, IDictionary<string, string[]>? errors = null)
        : base(detail)
    {
        Status = (int)status;
        Title = title;
        Detail = detail;
        Errors = errors;
    }

    public int Status { get; }
    public string Title { get; }
    public string Detail { get; }
    public IDictionary<string, string[]>? Errors { get; }

    public static AppException Validation(string detail, IDictionary<string, string[]>? errors = null)
        => new(HttpStatusCode.BadRequest, "Validation failed", detail, errors);

    public static AppException Unauthorized(string detail = "Authentication required.")
        => new(HttpStatusCode.Unauthorized, "Unauthorized", detail);

    public static AppException Forbidden(string detail = "Not allowed for this account.")
        => new(HttpStatusCode.Forbidden, "Forbidden", detail);

    public static AppException NotFound(string detail)
        => new(HttpStatusCode.NotFound, "Not found", detail);

    public static AppException Conflict(string detail, IDictionary<string, string[]>? errors = null)
        => new(HttpStatusCode.Conflict, "Conflict", detail, errors);

    public static AppException PayloadTooLarge(string detail)
        => new(HttpStatusCode.RequestEntityTooLarge, "Payload too large", detail);

    public static AppException UnsupportedMediaType(string detail)
        => new(HttpStatusCode.UnsupportedMediaType, "Unsupported media type", detail);
}

/// <summary>Login throttling. Carries the retry hint so the client can back off instead of hammering.</summary>
public sealed class TooManyRequestsException : AppException
{
    public TooManyRequestsException(string detail, TimeSpan retryAfter)
        : base(HttpStatusCode.TooManyRequests, "Too many requests", detail)
        => RetryAfter = retryAfter;

    public TimeSpan RetryAfter { get; }
}
