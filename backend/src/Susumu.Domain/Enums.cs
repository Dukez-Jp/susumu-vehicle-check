using System.Text.Json;
using System.Text.Json.Serialization;

namespace Susumu.Domain;

/// <summary>Wire values are fixed by docs/IMPLEMENTATION_CONTRACT.md and must not be renamed.</summary>
public enum UserRole
{
    Administrator = 0,
    Supervisor = 1,
    Inspector = 2,
    Office = 3,
}

public enum ItemStatus
{
    OK = 0,
    Attention = 1,
    Repair = 2,
    Critical = 3,
    NotApplicable = 4,
}

/// <summary>Serialized as lowercase (<c>status</c>/<c>measurement</c>) per the shared contract.</summary>
[JsonConverter(typeof(ResponseTypeJsonConverter))]
public enum ResponseType
{
    Status = 0,
    Measurement = 1,
}

public enum InspectionState
{
    Draft = 0,
    Finalized = 1,
}

public enum PhotoKind
{
    Original = 0,
    Annotation = 1,
    Signature = 2,
}

public enum PhotoUploadState
{
    Pending = 0,
    Complete = 1,
}

public sealed class ResponseTypeJsonConverter : JsonConverter<ResponseType>
{
    public override ResponseType Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var raw = reader.TokenType == JsonTokenType.String ? reader.GetString() : null;
        return raw?.ToLowerInvariant() switch
        {
            "status" => ResponseType.Status,
            "measurement" => ResponseType.Measurement,
            _ => throw new JsonException($"Unsupported responseType '{raw}'."),
        };
    }

    public override void Write(Utf8JsonWriter writer, ResponseType value, JsonSerializerOptions options)
        => writer.WriteStringValue(value == ResponseType.Measurement ? "measurement" : "status");
}
