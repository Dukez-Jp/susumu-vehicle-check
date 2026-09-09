using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Susumu.Domain.Entities;

namespace Susumu.Infrastructure.Persistence;

public sealed class EmployeeConfiguration : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> employee)
    {
        employee.ToTable("employees");
        employee.HasKey(e => e.Id);
        employee.Property(e => e.Id).ValueGeneratedNever();
        employee.Property(e => e.EmployeeNumber).HasMaxLength(40).IsRequired();
        employee.Property(e => e.Name).HasMaxLength(200).IsRequired();
        employee.Property(e => e.Version).IsConcurrencyToken();
        employee.HasIndex(e => new { e.CompanyId, e.EmployeeNumber }).IsUnique();
        // Nullable values allow multiple unlinked employees; linked users stay unique even after retirement.
        employee.HasIndex(e => new { e.CompanyId, e.UserId }).IsUnique();
        employee.HasOne<Company>().WithMany().HasForeignKey(e => e.CompanyId).OnDelete(DeleteBehavior.Restrict);
        // Composite FKs enforce company isolation even for non-HTTP writers.
        employee.HasOne<Location>().WithMany()
            .HasForeignKey(e => new { e.CompanyId, e.LocationId })
            .HasPrincipalKey(l => new { l.CompanyId, l.Id }).OnDelete(DeleteBehavior.Restrict);
        employee.HasOne<AppUser>().WithMany()
            .HasForeignKey(e => new { e.CompanyId, e.UserId })
            .HasPrincipalKey(u => new { u.CompanyId, u.Id }).OnDelete(DeleteBehavior.Restrict);
    }
}
