using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Services;

namespace Susumu.Api.Tests;

[Collection(EnvironmentSensitiveCollection.Name)]
public sealed class VehicleTypeMigrationTests
{
    [PostgresFact]
    public async Task Catalog_migration_backfills_case_insensitive_company_codes_without_changing_existing_references()
    {
        var connection = PostgresTestDatabase.RequireApprovedTarget();
        await using var db = new SusumuDbContext(new DbContextOptionsBuilder<SusumuDbContext>().UseNpgsql(connection).Options);
        await db.Database.EnsureDeletedAsync();
        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("20260909142321_ReviewHardening");
        var company = Guid.NewGuid();
        var otherCompany = Guid.NewGuid();
        var location = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        db.Companies.AddRange(new Company { Id = company, Name = "Before Catalog", CreatedAt = now },
            new Company { Id = otherCompany, Name = "Other Before Catalog", CreatedAt = now });
        db.Locations.Add(new Location { Id = location, CompanyId = company, Name = "Workshop", CreatedAt = now });
        var vehicleCodes = new[] { "Truck", "truck", "Caminhão", "Straße" };
        foreach (var code in vehicleCodes)
        {
            db.Vehicles.Add(new Vehicle
            {
                Id = Guid.NewGuid(), CompanyId = company, LocationId = location,
                InternalNumber = Guid.NewGuid().ToString("N"), Type = code, CreatedAt = now, UpdatedAt = now,
            });
        }
        foreach (var entry in new[] { (company, "TRUCK"), (company, "Van"), (company, "caminhão"), (company, "straße"), (otherCompany, "Truck") })
        {
            db.ChecklistTemplates.Add(new ChecklistTemplate
            {
                Id = Guid.NewGuid(), CompanyId = entry.Item1, Name = "Existing " + Guid.NewGuid().ToString("N"),
                VehicleType = entry.Item2, Version = 1, Published = true, CreatedAt = now, PublishedAt = now,
                CreatedByUserId = Guid.NewGuid(),
            });
        }
        await db.SaveChangesAsync();
        var oldTemplateId = await db.ChecklistTemplates.Select(t => t.Id).FirstAsync();
        var oldSectionId = Guid.NewGuid();
        var oldItemId = Guid.NewGuid();
        // Use the old column set intentionally: the new nullable options column does not exist yet.
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO checklist_sections ("Id", "TemplateId", "Title", "OrderIndex")
            VALUES ({oldSectionId}, {oldTemplateId}, 'Legacy section', 0);
            """);
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO checklist_items ("Id", "SectionId", "Label", "ResponseType", "Required", "OrderIndex")
            VALUES ({oldItemId}, {oldSectionId}, 'Legacy answer', 'Status', TRUE, 0);
            """);
        var beforeVehicles = await db.Vehicles.AsNoTracking().OrderBy(v => v.Id).Select(v => new { v.Id, v.Type }).ToListAsync();
        var beforeTemplates = await db.ChecklistTemplates.AsNoTracking().OrderBy(t => t.Id).Select(t => new { t.Id, t.VehicleType }).ToListAsync();
        await migrator.MigrateAsync();
        db.ChangeTracker.Clear();
        var catalog = await db.Set<VehicleType>().AsNoTracking().ToListAsync();
        Assert.Equal(5, catalog.Count);
        Assert.Equal(4, catalog.Count(t => t.CompanyId == company));
        Assert.Single(catalog, t => t.CompanyId == company && t.NormalizedCode == "TRUCK");
        Assert.Single(catalog, t => t.CompanyId == otherCompany && t.NormalizedCode == "TRUCK");
        Assert.All(catalog, t =>
        {
            Assert.True(t.Active);
            Assert.Equal(VehicleTypeService.NormalizeCode(t.Code), t.NormalizedCode);
        });
        Assert.Equal(beforeVehicles, await db.Vehicles.AsNoTracking().OrderBy(v => v.Id).Select(v => new { v.Id, v.Type }).ToListAsync());
        Assert.Equal(beforeTemplates, await db.ChecklistTemplates.AsNoTracking().OrderBy(t => t.Id).Select(t => new { t.Id, t.VehicleType }).ToListAsync());
        Assert.Equal(catalog.Single(t => t.CompanyId == company && t.NormalizedCode == "CAMINHÃO").Code,
            await VehicleTypeService.ResolveActiveCodeAsync(db, company, "CAMINHÃO", CancellationToken.None));
        var legacyItem = await db.ChecklistItems.SingleAsync(i => i.Id == oldItemId);
        Assert.Null(legacyItem.AllowedStatuses);
        Assert.Equal(ChecklistItem.StandardStatuses, legacyItem.EffectiveStatuses);
        legacyItem.AllowedStatuses = [ItemStatus.OK, ItemStatus.Repair];
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        Assert.Equal([ItemStatus.OK, ItemStatus.Repair],
            (await db.ChecklistItems.SingleAsync(i => i.Id == oldItemId)).AllowedStatuses);
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
    }
}
