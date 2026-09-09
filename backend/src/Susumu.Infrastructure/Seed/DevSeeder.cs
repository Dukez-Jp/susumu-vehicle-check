using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Susumu.Domain;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Services;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Seed;

public sealed record SeedReport(bool Executed, IReadOnlyDictionary<string, string> GeneratedPasswords);

/// <summary>
/// Idempotent Development fixture. It creates synthetic records only, never touches an existing row
/// it did not create, and refuses to run outside Development.
/// </summary>
public sealed class DevSeeder(
    SusumuDbContext db,
    IPasswordHashing hashing,
    IClock clock,
    IOptions<DevSeedOptions> options,
    ILogger<DevSeeder> logger)
{
    private readonly DevSeedOptions _options = options.Value;

    public async Task<SeedReport> RunAsync(bool isDevelopment, CancellationToken ct)
    {
        if (!_options.Enabled)
        {
            return new SeedReport(false, new Dictionary<string, string>());
        }

        if (!isDevelopment)
        {
            throw new InvalidOperationException(
                "The DEV seed contains synthetic data and must never run outside the Development environment.");
        }

        var now = clock.UtcNow;
        var generated = new Dictionary<string, string>();

        await EnsureCompanyAsync(now, ct);
        await EnsureUsersAsync(now, generated, ct);
        await EnsureVehicleTypesAsync(now, ct);
        await EnsureVehiclesAsync(now, ct);
        await EnsureTemplateAsync(now, ct);

        await db.SaveChangesAsync(ct);

        if (generated.Count > 0)
        {
            WriteCredentialsFile(generated);
        }

        logger.LogInformation("DEV seed applied. Synthetic company, users, vehicles and checklist template are present.");
        return new SeedReport(true, generated);
    }

    private async Task EnsureCompanyAsync(DateTimeOffset now, CancellationToken ct)
    {
        if (!await db.Companies.AnyAsync(c => c.Id == SeedIds.Company, ct))
        {
            db.Companies.Add(new Company
            {
                Id = SeedIds.Company,
                Name = "Susumu Sabisu (DEV)",
                Active = true,
                CreatedAt = now,
            });
        }

        if (!await db.Locations.AnyAsync(l => l.Id == SeedIds.Location, ct))
        {
            db.Locations.Add(new Location
            {
                Id = SeedIds.Location,
                CompanyId = SeedIds.Company,
                Name = "Oficina Central (DEV)",
                Active = true,
                CreatedAt = now,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task EnsureUsersAsync(
        DateTimeOffset now, IDictionary<string, string> generated, CancellationToken ct)
    {
        await EnsureUserAsync(SeedIds.Of(SeedIds.GroupUser, 1), _options.AdminUsername, "Administrador DEV",
            UserRole.Administrator, _options.AdminPassword, now, generated, ct);

        await EnsureUserAsync(SeedIds.Of(SeedIds.GroupUser, 2), "supervisor", "Supervisor DEV",
            UserRole.Supervisor, _options.SupervisorPassword, now, generated, ct);

        await EnsureUserAsync(SeedIds.Of(SeedIds.GroupUser, 3), "inspetor", "Inspetor DEV",
            UserRole.Inspector, _options.InspectorPassword, now, generated, ct);

        await EnsureUserAsync(SeedIds.Of(SeedIds.GroupUser, 4), "escritorio", "Escritório DEV",
            UserRole.Office, _options.OfficePassword, now, generated, ct);
    }

    private async Task EnsureUserAsync(
        Guid id,
        string username,
        string displayName,
        UserRole role,
        string? configuredPassword,
        DateTimeOffset now,
        IDictionary<string, string> generated,
        CancellationToken ct)
    {
        username = username.Trim().ToLowerInvariant();

        if (await db.Users.AnyAsync(u => u.Id == id || u.Username == username, ct))
        {
            // Never rewrite an account that already exists: a developer may have changed its password.
            return;
        }

        var password = configuredPassword;
        if (string.IsNullOrWhiteSpace(password))
        {
            password = GeneratePassword();
            generated[username] = password;
        }

        hashing.EnsureAcceptable(password);

        db.Users.Add(new AppUser
        {
            Id = id,
            CompanyId = SeedIds.Company,
            LocationId = SeedIds.Location,
            Name = displayName,
            Username = username,
            PasswordHash = hashing.Hash(password),
            Role = role,
            Active = true,
            SecurityStamp = Guid.NewGuid().ToString("N"),
            CreatedAt = now,
            UpdatedAt = now,
        });
    }

    private async Task EnsureVehicleTypesAsync(DateTimeOffset now, CancellationToken ct)
    {
        // Seed catalog entries before their synthetic vehicles/templates, without reactivating retired codes.
        foreach (var code in new[] { "Caminhão", "Van", "Truck" })
        {
            var normalized = VehicleTypeService.NormalizeCode(code);
            if (await db.Set<VehicleType>().AnyAsync(t => t.CompanyId == SeedIds.Company && t.NormalizedCode == normalized, ct)) { continue; }
            db.Set<VehicleType>().Add(new VehicleType
            {
                Id = Guid.NewGuid(), CompanyId = SeedIds.Company, Code = code, NormalizedCode = normalized,
                Name = code, Active = true, CreatedAt = now, UpdatedAt = now, Version = 1,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task EnsureVehiclesAsync(DateTimeOffset now, CancellationToken ct)
    {
        (Guid Id, string Number, string Plate, string Type, int Odometer)[] fixtures =
        [
            (SeedIds.Vehicle714, "714", "DEV-714", "Caminhão", 184_320),
            (SeedIds.Of(SeedIds.GroupVehicle, 715), "715", "DEV-715", "Caminhão", 92_140),
            (SeedIds.Of(SeedIds.GroupVehicle, 208), "208", "DEV-208", "Van", 45_870),
        ];

        foreach (var fixture in fixtures)
        {
            if (await db.Vehicles.AnyAsync(v => v.Id == fixture.Id, ct))
            {
                continue;
            }

            db.Vehicles.Add(new Vehicle
            {
                Id = fixture.Id,
                CompanyId = SeedIds.Company,
                LocationId = SeedIds.Location,
                InternalNumber = fixture.Number,
                Plate = fixture.Plate,
                Type = fixture.Type,
                CurrentOdometerKm = fixture.Odometer,
                Active = true,
                CreatedAt = now,
                UpdatedAt = now,
            });
        }
    }

    private async Task EnsureTemplateAsync(DateTimeOffset now, CancellationToken ct)
    {
        var templateId = SeedIds.Of(SeedIds.GroupTemplate, 1);
        if (await db.ChecklistTemplates.AnyAsync(t => t.Id == templateId, ct))
        {
            return;
        }

        var template = new ChecklistTemplate
        {
            Id = templateId,
            CompanyId = SeedIds.Company,
            Name = "Check-in diário de caminhão",
            VehicleType = "Caminhão",
            Version = 1,
            Published = true,
            RequiresSignature = false,
            PublishedAt = now,
            CreatedAt = now,
            CreatedByUserId = SeedIds.Of(SeedIds.GroupUser, 1),
        };

        var item = 0;
        var section = 0;

        AddSection("Documentação e cabine",
        [
            ("Documentos do veículo", ResponseType.Status, true, null, null, null),
            ("Extintor de incêndio", ResponseType.Status, true, null, null, null),
            ("Cinto de segurança", ResponseType.Status, true, null, null, null),
            ("Limpeza da cabine", ResponseType.Status, false, null, null, null),
        ]);

        AddSection("Motor e fluidos",
        [
            ("Nível do óleo do motor", ResponseType.Status, true, null, null, null),
            ("Nível do líquido de arrefecimento", ResponseType.Status, true, null, null, null),
            ("Vazamentos visíveis", ResponseType.Status, true, null, null, null),
            ("Tensão da bateria", ResponseType.Measurement, false, "V", 10m, 15m),
        ]);

        AddSection("Pneus e freios",
        [
            ("Pressão do pneu dianteiro esquerdo", ResponseType.Measurement, true, "kPa", 400m, 900m),
            ("Pressão do pneu dianteiro direito", ResponseType.Measurement, true, "kPa", 400m, 900m),
            ("Profundidade do sulco dianteiro", ResponseType.Measurement, true, "mm", 0m, 20m),
            ("Estado das lonas/pastilhas", ResponseType.Status, true, null, null, null),
            ("Freio de estacionamento", ResponseType.Status, true, null, null, null),
        ]);

        AddSection("Iluminação e segurança",
        [
            ("Faróis e lanternas", ResponseType.Status, true, null, null, null),
            ("Setas e pisca-alerta", ResponseType.Status, true, null, null, null),
            ("Buzina", ResponseType.Status, false, null, null, null),
            ("Triângulo e macaco", ResponseType.Status, false, null, null, null),
        ]);

        db.ChecklistTemplates.Add(template);
        return;

        void AddSection(
            string title,
            (string Label, ResponseType Type, bool Required, string? Unit, decimal? Min, decimal? Max)[] items)
        {
            var sectionEntity = new ChecklistSection
            {
                Id = SeedIds.Of(SeedIds.GroupSection, ++section),
                TemplateId = template.Id,
                Title = title,
                OrderIndex = section - 1,
            };

            var order = 0;
            foreach (var definition in items)
            {
                sectionEntity.Items.Add(new ChecklistItem
                {
                    Id = SeedIds.Of(SeedIds.GroupItem, ++item),
                    SectionId = sectionEntity.Id,
                    Label = definition.Label,
                    ResponseType = definition.Type,
                    Required = definition.Required,
                    Unit = definition.Unit,
                    MinValue = definition.Min,
                    MaxValue = definition.Max,
                    OrderIndex = order++,
                });
            }

            template.Sections.Add(sectionEntity);
        }
    }

    private void WriteCredentialsFile(IDictionary<string, string> generated)
    {
        if (string.IsNullOrWhiteSpace(_options.CredentialsFilePath))
        {
            logger.LogWarning("DEV passwords were generated but no credentials file path is configured.");
            return;
        }

        try
        {
            var directory = Path.GetDirectoryName(_options.CredentialsFilePath);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var payload = new
            {
                warning = "Synthetic DEV credentials. Never reuse outside the local development environment.",
                generatedAt = clock.UtcNow,
                users = generated,
            };

            File.WriteAllText(
                _options.CredentialsFilePath,
                JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true }));

            logger.LogInformation("Generated DEV passwords written to {Path}.", _options.CredentialsFilePath);
        }
        catch (IOException ex)
        {
            logger.LogWarning(ex, "Could not write the DEV credentials file.");
        }
    }

    private static string GeneratePassword()
        => "dev-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
}
