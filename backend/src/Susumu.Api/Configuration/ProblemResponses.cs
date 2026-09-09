using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Susumu.Api.Configuration;

/// <summary>
/// Gives the framework-generated rejections (401/403/404/405/415) the same ProblemDetails shape the
/// clients get from business failures, so error handling on the tablet has a single code path.
/// </summary>
public static class ProblemResponses
{
    public static async Task WriteAsync(StatusCodeContext context)
    {
        var response = context.HttpContext.Response;

        if (response.HasStarted || response.ContentLength is > 0)
        {
            return;
        }

        var (title, detail) = response.StatusCode switch
        {
            StatusCodes.Status401Unauthorized => ("Unauthorized", "Authentication is required for this endpoint."),
            StatusCodes.Status403Forbidden => ("Forbidden", "This account is not allowed to perform the operation."),
            StatusCodes.Status404NotFound => ("Not found", "The requested resource does not exist."),
            StatusCodes.Status405MethodNotAllowed => ("Method not allowed", "The HTTP method is not supported here."),
            StatusCodes.Status413PayloadTooLarge => ("Payload too large", "The request body exceeded the limit."),
            StatusCodes.Status415UnsupportedMediaType => ("Unsupported media type", "The request content type is not accepted."),
            StatusCodes.Status429TooManyRequests => ("Too many requests", "Slow down and retry later."),
            _ => ("Request failed", "The request could not be completed."),
        };

        response.ContentType = "application/problem+json";
        await response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = response.StatusCode,
            Title = title,
            Detail = detail,
            Instance = context.HttpContext.Request.Path,
        }, context.HttpContext.RequestAborted);
    }
}
