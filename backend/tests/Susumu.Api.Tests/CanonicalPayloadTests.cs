using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Tests;

/// <summary>
/// The idempotency fingerprint must be stable across harmless client-side differences and must
/// change whenever the recorded work changes; both directions are load-bearing for retry safety.
/// </summary>
public sealed class CanonicalPayloadTests
{
    private static readonly Guid OperationId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid InspectionId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid ItemA = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid ItemB = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid PhotoA = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid PhotoB = Guid.Parse("66666666-6666-6666-6666-666666666666");
    private static readonly DateTimeOffset Started = new(2026, 9, 9, 8, 0, 0, TimeSpan.Zero);

    private static SyncInspectionRequest Request(
        IReadOnlyList<InspectionItemDto> items, int odometer = 100, int expectedVersion = 0)
        => new(OperationId, expectedVersion, new InspectionDto(
            InspectionId, Guid.Empty, Guid.Empty, 1, "tablet-a", odometer,
            InspectionState.Draft, Started, null, items, null, null, null, 0));

    [Fact]
    public void Item_order_does_not_change_the_hash()
    {
        var ordered = Request([
            new InspectionItemDto(ItemA, ItemStatus.OK, null, null, null),
            new InspectionItemDto(ItemB, ItemStatus.Attention, 12m, "x", null),
        ]);

        var reversed = Request([
            new InspectionItemDto(ItemB, ItemStatus.Attention, 12m, "x", null),
            new InspectionItemDto(ItemA, ItemStatus.OK, null, null, null),
        ]);

        Assert.Equal(CanonicalPayload.Hash(ordered), CanonicalPayload.Hash(reversed));
    }

    [Fact]
    public void Photo_order_and_duplicates_do_not_change_the_hash()
    {
        var first = Request([new InspectionItemDto(ItemA, ItemStatus.OK, null, null, [PhotoA, PhotoB])]);
        var second = Request([new InspectionItemDto(ItemA, ItemStatus.OK, null, null, [PhotoB, PhotoA, PhotoA])]);

        Assert.Equal(CanonicalPayload.Hash(first), CanonicalPayload.Hash(second));
    }

    [Fact]
    public void Trailing_zeros_on_a_measurement_do_not_change_the_hash()
    {
        var plain = Request([new InspectionItemDto(ItemA, ItemStatus.OK, 620m, null, null)]);
        var padded = Request([new InspectionItemDto(ItemA, ItemStatus.OK, 620.0000m, null, null)]);

        Assert.Equal(CanonicalPayload.Hash(plain), CanonicalPayload.Hash(padded));
    }

    [Fact]
    public void A_different_measurement_changes_the_hash()
    {
        var original = Request([new InspectionItemDto(ItemA, ItemStatus.OK, 620m, null, null)]);
        var changed = Request([new InspectionItemDto(ItemA, ItemStatus.OK, 621m, null, null)]);

        Assert.NotEqual(CanonicalPayload.Hash(original), CanonicalPayload.Hash(changed));
    }

    [Fact]
    public void A_different_status_notes_or_odometer_changes_the_hash()
    {
        var baseline = Request([new InspectionItemDto(ItemA, ItemStatus.OK, null, "ok", null)]);

        Assert.NotEqual(
            CanonicalPayload.Hash(baseline),
            CanonicalPayload.Hash(Request([new InspectionItemDto(ItemA, ItemStatus.Critical, null, "ok", null)])));

        Assert.NotEqual(
            CanonicalPayload.Hash(baseline),
            CanonicalPayload.Hash(Request([new InspectionItemDto(ItemA, ItemStatus.OK, null, "not ok", null)])));

        Assert.NotEqual(
            CanonicalPayload.Hash(baseline),
            CanonicalPayload.Hash(Request([new InspectionItemDto(ItemA, ItemStatus.OK, null, "ok", null)], odometer: 101)));
    }

    [Fact]
    public void The_expected_version_is_part_of_the_operation_identity()
    {
        var items = new[] { new InspectionItemDto(ItemA, ItemStatus.OK, null, null, null) };

        Assert.NotEqual(
            CanonicalPayload.Hash(Request(items, expectedVersion: 0)),
            CanonicalPayload.Hash(Request(items, expectedVersion: 1)));
    }

    [Fact]
    public void A_missing_item_is_not_the_same_operation()
    {
        var both = Request([
            new InspectionItemDto(ItemA, ItemStatus.OK, null, null, null),
            new InspectionItemDto(ItemB, ItemStatus.OK, null, null, null),
        ]);

        var one = Request([new InspectionItemDto(ItemA, ItemStatus.OK, null, null, null)]);

        Assert.NotEqual(CanonicalPayload.Hash(both), CanonicalPayload.Hash(one));
    }

    [Fact]
    public void The_hash_is_a_lowercase_sha256_hex_digest()
    {
        var hash = CanonicalPayload.Hash(Request([]));

        Assert.Equal(64, hash.Length);
        Assert.Equal(hash.ToLowerInvariant(), hash);
        Assert.All(hash, c => Assert.True(Uri.IsHexDigit(c)));
    }
}
