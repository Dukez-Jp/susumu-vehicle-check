using Microsoft.EntityFrameworkCore;
using Susumu.Domain;
using Susumu.Domain.Entities;

namespace Susumu.Infrastructure.Persistence;

public sealed class SusumuDbContext(DbContextOptions<SusumuDbContext> options) : DbContext(options)
{
    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Vehicle> Vehicles => Set<Vehicle>();
    public DbSet<ChecklistTemplate> ChecklistTemplates => Set<ChecklistTemplate>();
    public DbSet<ChecklistSection> ChecklistSections => Set<ChecklistSection>();
    public DbSet<ChecklistItem> ChecklistItems => Set<ChecklistItem>();
    public DbSet<Inspection> Inspections => Set<Inspection>();
    public DbSet<InspectionItemRecord> InspectionItems => Set<InspectionItemRecord>();
    public DbSet<PhotoRecord> Photos => Set<PhotoRecord>();
    public DbSet<SyncOperationReceipt> SyncOperations => Set<SyncOperationReceipt>();
    public DbSet<AuditEntry> AuditEntries => Set<AuditEntry>();
    public DbSet<DeviceRecord> Devices => Set<DeviceRecord>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configuration)
    {
        configuration.Properties<DateTimeOffset>().HaveConversion<UtcDateTimeOffsetConverter>();
        configuration.Properties<DateTimeOffset?>().HaveConversion<UtcDateTimeOffsetConverter>();
    }

    protected override void OnModelCreating(ModelBuilder b)
    {
        // Picks up IEntityTypeConfiguration implementations that live beside this context, so an
        // entity owned by another worker (Employee) is mapped without editing this file's body.
        b.ApplyConfigurationsFromAssembly(typeof(SusumuDbContext).Assembly);

        b.Entity<Company>(e =>
        {
            e.ToTable("companies");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.AdministrationStamp).IsConcurrencyToken();
            e.HasIndex(x => x.Name).IsUnique();
        });

        b.Entity<Location>(e =>
        {
            e.ToTable("locations");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.HasOne(x => x.Company).WithMany(c => c.Locations)
                .HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.CompanyId, x.Name }).IsUnique();
        });

        b.Entity<AppUser>(e =>
        {
            e.ToTable("users");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.Username).HasMaxLength(120).IsRequired();
            e.Property(x => x.PasswordHash).HasMaxLength(400).IsRequired();
            e.Property(x => x.SecurityStamp).HasMaxLength(64).IsRequired();
            e.Property(x => x.Role).HasConversion<string>().HasMaxLength(32).IsRequired();
            e.HasOne(x => x.Company).WithMany().HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Location).WithMany().HasForeignKey(x => x.LocationId).OnDelete(DeleteBehavior.Restrict);
            // Globally unique so login never has to guess which company a username belongs to.
            e.HasIndex(x => x.Username).IsUnique();
            e.HasIndex(x => new { x.CompanyId, x.LocationId });
        });

        b.Entity<Vehicle>(e =>
        {
            e.ToTable("vehicles");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.InternalNumber).HasMaxLength(40).IsRequired();
            e.Property(x => x.Plate).HasMaxLength(40);
            e.Property(x => x.Type).HasMaxLength(80).IsRequired();

            // Lost-update protection for the odometer: the UPDATE carries the value that was read.
            e.Property(x => x.CurrentOdometerKm).IsConcurrencyToken();

            e.HasOne<Company>().WithMany().HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Location>().WithMany().HasForeignKey(x => x.LocationId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.CompanyId, x.InternalNumber }).IsUnique();
            e.HasIndex(x => new { x.CompanyId, x.Plate });
        });

        b.Entity<ChecklistTemplate>(e =>
        {
            e.ToTable("checklist_templates");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Name).HasMaxLength(200).IsRequired();
            e.Property(x => x.VehicleType).HasMaxLength(80).IsRequired();
            e.HasOne<Company>().WithMany().HasForeignKey(x => x.CompanyId).OnDelete(DeleteBehavior.Restrict);
            // A template family is (company, vehicle type, name); publishing adds a version row.
            e.HasIndex(x => new { x.CompanyId, x.VehicleType, x.Name, x.Version }).IsUnique();
        });

        b.Entity<ChecklistSection>(e =>
        {
            e.ToTable("checklist_sections");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Title).HasMaxLength(200).IsRequired();
            e.HasOne(x => x.Template).WithMany(t => t.Sections)
                .HasForeignKey(x => x.TemplateId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.TemplateId);
        });

        b.Entity<ChecklistItem>(e =>
        {
            e.ToTable("checklist_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Label).HasMaxLength(300).IsRequired();
            e.Property(x => x.Unit).HasMaxLength(40);
            e.Property(x => x.ResponseType).HasConversion<string>().HasMaxLength(32).IsRequired();
            e.Property(x => x.MinValue).HasPrecision(18, 4);
            e.Property(x => x.MaxValue).HasPrecision(18, 4);
            e.HasOne(x => x.Section).WithMany(s => s.Items)
                .HasForeignKey(x => x.SectionId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => x.SectionId);
        });

        b.Entity<Inspection>(e =>
        {
            e.ToTable("inspections");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.DeviceId).HasMaxLength(120).IsRequired();
            e.Property(x => x.Notes).HasMaxLength(4000);
            e.Property(x => x.CorrectionReason).HasMaxLength(1000);
            e.Property(x => x.State).HasConversion<string>().HasMaxLength(32).IsRequired();
            e.Property(x => x.Version).IsConcurrencyToken();
            e.HasOne(x => x.Vehicle).WithMany().HasForeignKey(x => x.VehicleId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Template).WithMany().HasForeignKey(x => x.TemplateId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.CreatedBy).WithMany().HasForeignKey(x => x.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Inspection>().WithMany().HasForeignKey(x => x.SupersedesInspectionId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.CompanyId, x.LocationId, x.State });
            e.HasIndex(x => new { x.VehicleId, x.StartedAt });
            e.HasIndex(x => x.CreatedByUserId);
        });

        b.Entity<InspectionItemRecord>(e =>
        {
            e.ToTable("inspection_items");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
            e.Property(x => x.Value).HasPrecision(18, 4);
            e.Property(x => x.Notes).HasMaxLength(2000);
            e.HasOne(x => x.Inspection).WithMany(i => i.Items)
                .HasForeignKey(x => x.InspectionId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.InspectionId, x.ItemId }).IsUnique();
        });

        b.Entity<PhotoRecord>(e =>
        {
            e.ToTable("photos");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Kind).HasConversion<string>().HasMaxLength(32).IsRequired();

            // Concurrency token: two simultaneous uploads for one declared photo cannot both commit,
            // so the stored checksum and the stored bytes can never disagree.
            e.Property(x => x.Uploaded).IsConcurrencyToken();

            e.Property(x => x.ContentType).HasMaxLength(120);
            e.Property(x => x.Sha256).HasMaxLength(64);
            e.Property(x => x.StoragePath).HasMaxLength(400);
            e.HasOne(x => x.Inspection).WithMany(i => i.Photos)
                .HasForeignKey(x => x.InspectionId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<PhotoRecord>().WithMany().HasForeignKey(x => x.OriginalPhotoId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.InspectionId, x.Uploaded });
        });

        b.Entity<SyncOperationReceipt>(e =>
        {
            e.ToTable("sync_operations");
            e.HasKey(x => x.OperationId);
            e.Property(x => x.OperationId).ValueGeneratedNever();
            e.Property(x => x.DeviceId).HasMaxLength(120).IsRequired();
            e.Property(x => x.PayloadHash).HasMaxLength(64).IsRequired();
            e.Property(x => x.ResponseJson).IsRequired();
            e.HasIndex(x => x.InspectionId);
        });

        b.Entity<AuditEntry>(e =>
        {
            e.ToTable("audit_log");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).ValueGeneratedNever();
            e.Property(x => x.Action).HasMaxLength(80).IsRequired();
            e.Property(x => x.EntityType).HasMaxLength(80).IsRequired();
            e.Property(x => x.Details).HasMaxLength(2000);
            e.HasIndex(x => new { x.CompanyId, x.At });
            e.HasIndex(x => x.InspectionId);
        });

        b.Entity<DeviceRecord>(e =>
        {
            e.ToTable("devices");
            e.HasKey(x => x.DeviceId);
            e.Property(x => x.DeviceId).HasMaxLength(120).ValueGeneratedNever();
        });
    }
}
