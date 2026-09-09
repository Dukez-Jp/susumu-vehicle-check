using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Susumu.Domain;

namespace Susumu.Api.Configuration;

/// <summary>
/// Turns domain failures into ProblemDetails with the contracted status codes and keeps unexpected
/// exceptions opaque to clients while logging them in full.
/// </summary>
public sealed class AppExceptionHandler(ILogger<AppExceptionHandler> logger) : IExceptionHandler
{
    /// <summary>Non-standard but widely used code for "the caller went away mid-request".</summary>
    private const int ClientClosedRequest = 499;

    public async ValueTask<bool> TryHandleAsync(
        HttpContext context, Exception exception, CancellationToken ct)
    {
        var problem = Map(context, exception, out var logAsError);

        if (logAsError)
        {
            logger.LogError(exception, "Unhandled error on {Method} {Path}.", context.Request.Method, context.Request.Path);
        }
        else
        {
            logger.LogInformation("Rejected {Method} {Path}: {Status} {Title}.",
                context.Request.Method, context.Request.Path, problem.Status, problem.Title);
        }

        context.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        problem.Instance ??= context.Request.Path;
        await context.Response.WriteAsJsonAsync(problem, ct);
        return true;
    }

    private static ProblemDetails Map(HttpContext context, Exception exception, out bool logAsError)
    {
        logAsError = false;

        switch (exception)
        {
            case TooManyRequestsException tooMany:
                context.Response.Headers.RetryAfter =
                    ((int)Math.Ceiling(tooMany.RetryAfter.TotalSeconds)).ToString();
                return Problem(tooMany);

            case AppException app:
                return Problem(app);

            case BadHttpRequestException bad:
                return new ProblemDetails
                {
                    Status = bad.StatusCode,
                    Title = bad.StatusCode == StatusCodes.Status413PayloadTooLarge ? "Payload too large" : "Bad request",
                    Detail = bad.StatusCode == StatusCodes.Status413PayloadTooLarge
                        ? "The request body exceeded the configured limit."
                        : "The request could not be read.",
                };

            case InvalidDataException:
                return new ProblemDetails
                {
                    Status = StatusCodes.Status413PayloadTooLarge,
                    Title = "Payload too large",
                    Detail = "The multipart body exceeded the configured limit.",
                };

            case OperationCanceledException when context.RequestAborted.IsCancellationRequested:
                return new ProblemDetails
                {
                    Status = ClientClosedRequest,
                    Title = "Client closed request",
                    Detail = "The client disconnected before the request completed.",
                };

            default:
                logAsError = true;
                return new ProblemDetails
                {
                    Status = StatusCodes.Status500InternalServerError,
                    Title = "Unexpected error",
                    Detail = "The request could not be completed. The failure was logged on the server.",
                };
        }
    }

    private static ProblemDetails Problem(AppException exception)
    {
        var problem = new ProblemDetails
        {
            Status = exception.Status,
            Title = exception.Title,
            Detail = exception.Detail,
        };

        if (exception.Errors is { Count: > 0 })
        {
            problem.Extensions["errors"] = exception.Errors;
        }

        return problem;
    }
}
