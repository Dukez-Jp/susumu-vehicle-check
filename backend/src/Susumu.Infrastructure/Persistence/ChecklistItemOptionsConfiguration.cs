using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Susumu.Domain;
using Susumu.Domain.Entities;

namespace Susumu.Infrastructure.Persistence;

/// <summary>
/// Persists the configurable answer options of a checklist item. The list is stored as a JSON array
/// of the wire names (<c>["OK","Repair"]</c>) in a single nullable column, so a template version
/// written before the feature existed keeps a NULL and keeps meaning "the standard statuses".
/// Applied through <c>ApplyConfigurationsFromAssembly</c>; the rest of the item mapping lives in
/// <see cref="SusumuDbContext"/> and is untouched.
/// </summary>
public sealed class ChecklistItemOptionsConfiguration : IEntityTypeConfiguration<ChecklistItem>
{
    /// <summary>Five names plus separators; wide enough for the whole classification and no wider.</summary>
    public const int MaxLength = 200;

    public const string ColumnName = "AllowedStatuses";

    private static readonly ValueConverter<IReadOnlyList<ItemStatus>?, string?> OptionsConverter =
        new(options => Serialize(options), stored => Deserialize(stored));

    // Options are replaced wholesale, never mutated in place, but EF still needs a deep comparer to
    // detect a change and to snapshot the list instead of the reference.
    private static readonly ValueComparer<IReadOnlyList<ItemStatus>?> OptionsComparer = new(
        (left, right) => left == null ? right == null : right != null && left.SequenceEqual(right),
        options => options == null ? 0 : options.Aggregate(0, (hash, status) => HashCode.Combine(hash, (int)status)),
        options => options == null ? null : options.ToList());

    public void Configure(EntityTypeBuilder<ChecklistItem> item)
    {
        item.Property(x => x.AllowedStatuses)
            .HasColumnName(ColumnName)
            .HasConversion(OptionsConverter, OptionsComparer)
            .HasMaxLength(MaxLength);

        // Derived views of the stored column; persisting them would duplicate the source of truth.
        item.Ignore(x => x.EffectiveStatuses);
    }

    private static string? Serialize(IReadOnlyList<ItemStatus>? options)
        => options is null ? null : JsonSerializer.Serialize(options, SusumuJson.Options);

    private static IReadOnlyList<ItemStatus>? Deserialize(string? stored)
        => string.IsNullOrWhiteSpace(stored)
            ? null
            : JsonSerializer.Deserialize<List<ItemStatus>>(stored, SusumuJson.Options);
}
