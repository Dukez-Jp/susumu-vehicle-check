using System.Text.Json;
using System.Text.Json.Serialization;
using Susumu.Domain;

namespace Susumu.Infrastructure;

/// <summary>
/// One JSON configuration for the API surface, stored sync receipts and multipart metadata, so a
/// replayed response is byte-identical to the original one.
/// </summary>
public static class SusumuJson
{
    public static readonly JsonSerializerOptions Options = Create();

    private static JsonSerializerOptions Create()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        };

        Configure(options);
        return options;
    }

    /// <summary>
    /// Applies the enum policy to any options instance, including the one ASP.NET Core builds for
    /// minimal APIs, so the HTTP surface and the internal serializer cannot drift apart.
    /// </summary>
    public static void Configure(JsonSerializerOptions options)
    {
        // Order matters. System.Text.Json consults options.Converters before a [JsonConverter]
        // attribute on the type, so the blanket string-enum converter would otherwise win and emit
        // "Status"/"Measurement" instead of the contract's lowercase responseType.
        options.Converters.Add(new ResponseTypeJsonConverter());

        // Enum members go on the wire verbatim (OK, NotApplicable, Draft, Original, ...).
        // allowIntegerValues:false rejects numeric payloads such as 999, which would otherwise
        // deserialize into an undefined enum value.
        options.Converters.Add(new JsonStringEnumConverter(namingPolicy: null, allowIntegerValues: false));
    }
}
