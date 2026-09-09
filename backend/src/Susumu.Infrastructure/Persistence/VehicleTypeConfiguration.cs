using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Susumu.Domain.Entities;

namespace Susumu.Infrastructure.Persistence;

public sealed class VehicleTypeConfiguration : IEntityTypeConfiguration<VehicleType>
{
    public void Configure(EntityTypeBuilder<VehicleType> type)
    {
        type.ToTable("vehicle_types");
        type.HasKey(t => t.Id);
        type.Property(t => t.Id).ValueGeneratedNever();
        type.Property(t => t.Code).HasMaxLength(80).IsRequired();
        type.Property(t => t.NormalizedCode).HasMaxLength(80).IsRequired();
        type.Property(t => t.Name).HasMaxLength(120).IsRequired();
        type.Property(t => t.Version).IsConcurrencyToken();
        type.HasIndex(t => new { t.CompanyId, t.NormalizedCode }).IsUnique();
        type.HasOne<Company>().WithMany().HasForeignKey(t => t.CompanyId).OnDelete(DeleteBehavior.Restrict);
    }
}
