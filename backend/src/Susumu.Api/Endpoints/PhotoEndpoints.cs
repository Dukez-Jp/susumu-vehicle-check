using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Susumu.Api.Security;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Endpoints;

public static class PhotoEndpoints
{
    public static void MapPhotoEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/inspections/{id:guid}/photos").WithTags("Photos");

        group.MapPost("/{photoId:guid}", async (
                Guid id,
                Guid photoId,
                IFormFile file,
                [FromForm] string? metadata,
                HttpContext http,
                PhotoService service,
                CancellationToken ct) =>
            {
                var parsed = ParseMetadata(metadata);
                await using var stream = file.OpenReadStream();

                var photo = await service.UploadAsync(
                    http.CurrentUser(), id, photoId, parsed, stream, parsed?.ContentType ?? file.ContentType, ct);

                return Results.Ok(photo);
            })
            .RequireAuthorization(SusumuAuthentication.PolicyInspector)
            .DisableAntiforgery()
            .WithName("UploadInspectionPhoto")
            .WithSummary("Stores verified attachment bytes for a declared photo id.");

        group.MapGet("/{photoId:guid}", async (
                Guid id, Guid photoId, HttpContext http, PhotoService service, CancellationToken ct) =>
            {
                var (content, contentType, fileName) = await service.DownloadAsync(http.CurrentUser(), id, photoId, ct);
                return Results.File(content, contentType, fileName);
            })
            .WithName("DownloadInspectionPhoto");
    }

    private static PhotoUploadMetadata? ParseMetadata(string? metadata)
    {
        if (string.IsNullOrWhiteSpace(metadata))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<PhotoUploadMetadata>(metadata, SusumuJson.Options);
        }
        catch (JsonException ex)
        {
            throw AppException.Validation($"The metadata part is not valid JSON: {ex.Message}");
        }
    }
}
