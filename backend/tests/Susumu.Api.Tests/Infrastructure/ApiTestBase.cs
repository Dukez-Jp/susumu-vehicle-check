using System.Net.Http.Json;
using System.Text.Json;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure;

namespace Susumu.Api.Tests.Infrastructure;

public abstract class ApiTestBase : IAsyncLifetime
{
    protected TestApp App { get; } = new();

    protected TestFixture Fixture => App.Fixture;

    protected const string Device = "tablet-test-01";

    public Task InitializeAsync() => App.InitializeAsync();

    public Task DisposeAsync() => App.DisposeAsync();

    protected static readonly DateTimeOffset StartedAt = new(2026, 9, 9, 8, 30, 0, TimeSpan.Zero);

    protected InspectionDto Inspection(
        Guid id,
        IReadOnlyList<InspectionItemDto>? items = null,
        InspectionState state = InspectionState.Draft,
        int odometerKm = 100_500,
        string deviceId = Device,
        Guid? vehicleId = null,
        Guid? templateId = null,
        int templateVersion = 1,
        Guid? supersedes = null,
        string? correctionReason = null,
        string? notes = null)
        => new(
            id,
            vehicleId ?? Fixture.TruckId,
            templateId ?? Fixture.TemplateId,
            templateVersion,
            deviceId,
            odometerKm,
            state,
            StartedAt,
            state == InspectionState.Finalized ? StartedAt.AddMinutes(20) : null,
            items ?? [],
            notes,
            supersedes,
            correctionReason,
            0);

    /// <summary>Every required response present and inside bounds: a payload that may be finalized.</summary>
    protected IReadOnlyList<InspectionItemDto> CompleteItems(
        decimal pressure = 620m, ItemStatus brakeStatus = ItemStatus.OK, IReadOnlyList<Guid>? photoIds = null)
        =>
        [
            new(Fixture.RequiredStatusItemId, brakeStatus, null, "Sem folga", photoIds),
            new(Fixture.RequiredMeasurementItemId, ItemStatus.OK, pressure, null, null),
        ];

    protected static SyncInspectionRequest Operation(Guid operationId, int expectedVersion, InspectionDto inspection)
        => new(operationId, expectedVersion, inspection);
}

public static class HttpTestExtensions
{
    public static Task<HttpResponseMessage> PostJsonAsync<T>(this HttpClient client, string url, T payload)
        => client.PostAsJsonAsync(url, payload, SusumuJson.Options);

    public static Task<HttpResponseMessage> PutJsonAsync<T>(this HttpClient client, string url, T payload)
        => client.PutAsJsonAsync(url, payload, SusumuJson.Options);

    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"Expected success but got {(int)response.StatusCode}: {body}");
        return JsonSerializer.Deserialize<T>(body, SusumuJson.Options)
               ?? throw new InvalidOperationException($"Could not deserialize response body: {body}");
    }

    public static async Task<ProblemPayload> ReadProblemAsync(this HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<ProblemPayload>(body, SusumuJson.Options)
               ?? throw new InvalidOperationException($"Could not deserialize problem body: {body}");
    }
}

public sealed record ProblemPayload(
    string? Title,
    string? Detail,
    int? Status,
    Dictionary<string, string[]>? Errors);
