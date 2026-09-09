using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Susumu.Domain.Contracts;

namespace Susumu.Infrastructure.Services;

/// <summary>
/// Deterministic serialization of a sync operation, used as the idempotency fingerprint.
/// Property order, item order and number formatting are fixed here rather than inherited from the
/// client's JSON, so a byte-for-byte different retry of the same logical operation still matches.
/// </summary>
public static class CanonicalPayload
{
    public static string Hash(SyncInspectionRequest request)
    {
        var canonical = Build(request);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }

    internal static string Build(SyncInspectionRequest request)
    {
        var buffer = new MemoryStream();
        using (var w = new Utf8JsonWriter(buffer, new JsonWriterOptions { Indented = false }))
        {
            w.WriteStartObject();
            w.WriteString("operationId", request.OperationId.ToString("D"));
            w.WriteNumber("expectedVersion", request.ExpectedVersion);

            var inspection = request.Inspection;
            if (inspection is null)
            {
                w.WriteNull("inspection");
            }
            else
            {
                w.WritePropertyName("inspection");
                w.WriteStartObject();
                w.WriteString("id", inspection.Id.ToString("D"));
                w.WriteString("vehicleId", inspection.VehicleId.ToString("D"));
                w.WriteString("templateId", inspection.TemplateId.ToString("D"));
                w.WriteNumber("templateVersion", inspection.TemplateVersion);
                w.WriteString("deviceId", inspection.DeviceId ?? string.Empty);
                w.WriteNumber("odometerKm", inspection.OdometerKm);
                w.WriteString("state", inspection.State.ToString());
                w.WriteString("startedAt", Timestamp(inspection.StartedAt));
                w.WriteString("finalizedAt", inspection.FinalizedAt is null ? string.Empty : Timestamp(inspection.FinalizedAt.Value));
                w.WriteString("notes", inspection.Notes ?? string.Empty);
                w.WriteString("supersedesInspectionId", inspection.SupersedesInspectionId?.ToString("D") ?? string.Empty);
                w.WriteString("correctionReason", inspection.CorrectionReason ?? string.Empty);
                w.WriteString("signaturePhotoId", inspection.SignaturePhotoId?.ToString("D") ?? string.Empty);

                w.WritePropertyName("items");
                w.WriteStartArray();
                foreach (var item in (inspection.Items ?? []).OrderBy(i => i.ItemId))
                {
                    w.WriteStartObject();
                    w.WriteString("itemId", item.ItemId.ToString("D"));
                    w.WriteString("status", item.Status?.ToString() ?? string.Empty);
                    w.WriteString("value", Number(item.Value));
                    w.WriteString("notes", item.Notes ?? string.Empty);
                    w.WritePropertyName("photoIds");
                    w.WriteStartArray();
                    foreach (var photoId in (item.PhotoIds ?? []).Distinct().OrderBy(id => id))
                    {
                        w.WriteStringValue(photoId.ToString("D"));
                    }

                    w.WriteEndArray();
                    w.WriteEndObject();
                }

                w.WriteEndArray();
                w.WriteEndObject();
            }

            w.WriteEndObject();
        }

        return Encoding.UTF8.GetString(buffer.ToArray());
    }

    private static string Timestamp(DateTimeOffset value)
        => value.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffffffZ", CultureInfo.InvariantCulture);

    /// <summary>Normalized to the four decimals the database stores, so 1.5 and 1.5000 hash alike.</summary>
    private static string Number(decimal? value)
        => value is null ? string.Empty : Math.Round(value.Value, 4, MidpointRounding.ToEven).ToString("0.####", CultureInfo.InvariantCulture);
}
