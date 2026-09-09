using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Time;

namespace Susumu.Infrastructure.Services;

public static class OrganizationAdministrationRegistration
{
    public static IServiceCollection AddOrganizationAdministration(this IServiceCollection services)
        => services.AddScoped<OrganizationAdministrationService>();
}

public sealed class OrganizationAdministrationService(SusumuDbContext db, IClock clock)
{
    /// <summary>
    /// Serializes company-wide invariants. User/vehicle administrative writers must use this same
    /// transaction before reading a location's Active flag and hold it through SaveChanges/Commit.
    /// PostgreSQL locks the company row; SQLite takes a write reservation for the test transaction.
    /// </summary>
    public static async Task<IDbContextTransaction> BeginCompanyWriteAsync(
        SusumuDbContext context, Guid companyId, CancellationToken ct)
    {
        var transaction = await context.Database.BeginTransactionAsync(ct);
        try
        {
            if (context.Database.IsNpgsql())
            {
                await context.Database.ExecuteSqlInterpolatedAsync(
                    $"SELECT \"Id\" FROM companies WHERE \"Id\" = {companyId} FOR UPDATE", ct);
            }
            else
            {
                await context.Companies.Where(c => c.Id == companyId)
                    .ExecuteUpdateAsync(update => update.SetProperty(c => c.Name, c => c.Name), ct);
            }

            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }

    public async Task<CompanyDto> GetCompanyAsync(CurrentUser actor, CancellationToken ct)
    {
        await RequireActiveAdministratorAsync(db, actor, ct);
        var company = await db.Companies.AsNoTracking().SingleAsync(c => c.Id == actor.CompanyId, ct);
        return new CompanyDto(company.Id, company.Name, company.Active);
    }

    public Task<CompanyDto> UpdateCompanyAsync(CurrentUser actor, CompanyWriteRequest request, CancellationToken ct)
        => WriteAsync(actor, async () =>
        {
            var name = RequiredText(request.Name, "name", 200);
            var company = await db.Companies.SingleAsync(c => c.Id == actor.CompanyId, ct);
            company.Name = name;
            AddAudit(actor, "company.updated", "company", company.Id);
            return new CompanyDto(company.Id, company.Name, company.Active);
        }, ct);

    public async Task<IReadOnlyList<LocationDto>> ListLocationsAsync(CurrentUser actor, CancellationToken ct)
    {
        await RequireActiveAdministratorAsync(db, actor, ct);
        return await db.Locations.AsNoTracking().Where(l => l.CompanyId == actor.CompanyId)
            .OrderBy(l => l.Name).ThenBy(l => l.Id)
            .Select(l => new LocationDto(l.Id, l.CompanyId, l.Name, l.Active)).ToListAsync(ct);
    }

    public Task<LocationDto> CreateLocationAsync(CurrentUser actor, CreateLocationRequest request, CancellationToken ct)
        => WriteAsync(actor, () =>
        {
            var location = new Location
            {
                Id = Guid.NewGuid(), CompanyId = actor.CompanyId,
                Name = RequiredText(request.Name, "name", 200), Active = true, CreatedAt = clock.UtcNow,
            };
            db.Locations.Add(location);
            AddAudit(actor, "location.created", "location", location.Id);
            return Task.FromResult(ToDto(location));
        }, ct);

    public Task<LocationDto> UpdateLocationAsync(
        CurrentUser actor, Guid id, UpdateLocationRequest request, CancellationToken ct)
        => WriteAsync(actor, async () =>
        {
            var location = await db.Locations.SingleOrDefaultAsync(l => l.Id == id && l.CompanyId == actor.CompanyId, ct)
                ?? throw AppException.NotFound("Location was not found in your company.");
            var name = RequiredText(request.Name, "name", 200);
            var active = request.Active ?? throw FieldError("active", "Required.");
            if (location.Active && !active)
            {
                if (!await db.Locations.AnyAsync(l => l.CompanyId == actor.CompanyId && l.Active && l.Id != id, ct))
                {
                    throw AppException.Conflict("The last active location cannot be deactivated.");
                }

                if (await db.Users.AnyAsync(u => u.CompanyId == actor.CompanyId && u.LocationId == id && u.Active, ct) ||
                    await db.Vehicles.AnyAsync(v => v.CompanyId == actor.CompanyId && v.LocationId == id && v.Active, ct) ||
                    await db.Set<Employee>().AnyAsync(e => e.CompanyId == actor.CompanyId && e.LocationId == id && e.Active, ct))
                {
                    throw AppException.Conflict("Reassign or deactivate active users, vehicles and employees before deactivating this location.");
                }
            }

            location.Name = name;
            location.Active = active;
            AddAudit(actor, "location.updated", "location", location.Id, $"active={active}");
            return ToDto(location);
        }, ct);

    public async Task<IReadOnlyList<EmployeeDto>> ListEmployeesAsync(CurrentUser actor, CancellationToken ct)
    {
        await RequireActiveAdministratorAsync(db, actor, ct);
        return await db.Set<Employee>().AsNoTracking().Where(e => e.CompanyId == actor.CompanyId)
            .OrderBy(e => e.EmployeeNumber).ThenBy(e => e.Id)
            .Select(e => new EmployeeDto(e.Id, e.UserId, e.EmployeeNumber, e.Name, e.LocationId, e.Active))
            .ToListAsync(ct);
    }

    public Task<EmployeeDto> CreateEmployeeAsync(CurrentUser actor, EmployeeWriteRequest request, CancellationToken ct)
        => WriteAsync(actor, async () =>
        {
            var employee = new Employee
            {
                Id = Guid.NewGuid(), CompanyId = actor.CompanyId, CreatedAt = clock.UtcNow,
            };
            await ApplyEmployeeAsync(actor, employee, request, ct);
            db.Set<Employee>().Add(employee);
            AddAudit(actor, "employee.created", "employee", employee.Id,
                $"locationId={employee.LocationId}; userId={employee.UserId}; active={employee.Active}");
            return ToDto(employee);
        }, ct);

    public Task<EmployeeDto> UpdateEmployeeAsync(
        CurrentUser actor, Guid id, EmployeeWriteRequest request, CancellationToken ct)
        => WriteAsync(actor, async () =>
        {
            var employee = await db.Set<Employee>().SingleOrDefaultAsync(e => e.Id == id && e.CompanyId == actor.CompanyId, ct)
                ?? throw AppException.NotFound("Employee was not found in your company.");
            await ApplyEmployeeAsync(actor, employee, request, ct);
            AddAudit(actor, "employee.updated", "employee", employee.Id,
                $"locationId={employee.LocationId}; userId={employee.UserId}; active={employee.Active}");
            return ToDto(employee);
        }, ct);

    private async Task ApplyEmployeeAsync(CurrentUser actor, Employee employee, EmployeeWriteRequest request, CancellationToken ct)
    {
        var number = RequiredText(request.EmployeeNumber, "employeeNumber", 40).ToUpperInvariant();
        var name = RequiredText(request.Name, "name", 200);
        var locationId = request.LocationId ?? throw FieldError("locationId", "Required.");
        var active = request.Active ?? throw FieldError("active", "Required.");
        var location = await db.Locations.AsNoTracking()
            .SingleOrDefaultAsync(l => l.Id == locationId && l.CompanyId == actor.CompanyId, ct);
        if (location is null || (active && !location.Active))
        {
            throw FieldError("locationId", "Select a location in your company; active employees require an active location.");
        }

        if (request.UserId is { } userId)
        {
            var validUser = await db.Users.AsNoTracking().AnyAsync(u =>
                u.Id == userId && u.CompanyId == actor.CompanyId &&
                (!active || (u.Active && u.Location != null && u.Location.Active)), ct);
            if (!validUser)
            {
                throw FieldError("userId", "Select a user in your company; active employees require an active user and user location.");
            }

            if (await db.Set<Employee>().AnyAsync(e =>
                    e.CompanyId == actor.CompanyId && e.UserId == userId && e.Id != employee.Id, ct))
            {
                throw AppException.Conflict("This user is already linked to an employee.");
            }
        }

        if (await db.Set<Employee>().AnyAsync(e =>
                e.CompanyId == actor.CompanyId && e.EmployeeNumber == number && e.Id != employee.Id, ct))
        {
            throw AppException.Conflict("Employee number already exists in this company.");
        }

        employee.EmployeeNumber = number;
        employee.Name = name;
        employee.LocationId = locationId;
        employee.UserId = request.UserId;
        employee.Active = active;
        employee.UpdatedAt = clock.UtcNow;
        employee.Version++;
    }

    private async Task<T> WriteAsync<T>(CurrentUser actor, Func<Task<T>> operation, CancellationToken ct)
    {
        if (!actor.IsAdministrator) { throw AppException.Forbidden("Only administrators can manage organization records."); }
        await using var transaction = await BeginCompanyWriteAsync(db, actor.CompanyId, ct);
        await RequireActiveAdministratorAsync(db, actor, ct);
        try
        {
            var result = await operation();
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return result;
        }
        catch (DbUpdateException)
        {
            // Includes unique/FK/concurrency conflicts. Never expose SQL or a connection string.
            throw AppException.Conflict("The organization change conflicts with an existing record or a concurrent update.");
        }
        catch (PostgresException ex) when (ex.SqlState is "40001" or "40P01")
        {
            throw AppException.Conflict("A concurrent organization change occurred; reload and retry.");
        }
    }

    public static async Task RequireActiveAdministratorAsync(
        SusumuDbContext context, CurrentUser actor, CancellationToken ct)
    {
        // Authentication may have completed before this request waited for the company lock.
        // Re-read the persisted actor so queued mutations cannot outlive role/account revocation.
        if (!actor.IsAdministrator || !await context.Users.AsNoTracking().AnyAsync(u =>
                u.Id == actor.Id && u.CompanyId == actor.CompanyId && u.Active && u.Role == UserRole.Administrator &&
                u.Company != null && u.Company.Active && u.Location != null && u.Location.Active &&
                u.Location.CompanyId == actor.CompanyId, ct))
        {
            throw AppException.Forbidden("An active administrator account, company and location are required to manage organization records.");
        }
    }

    private void AddAudit(CurrentUser actor, string action, string entityType, Guid id, string? details = null)
        => db.AuditEntries.Add(Audit.Entry(clock.UtcNow, actor.Id, actor.CompanyId, action, entityType, id, details: details));

    private static string RequiredText(string? value, string field, int maximum)
    {
        var text = value?.Trim() ?? string.Empty;
        if (text.Length == 0 || text.Length > maximum || text.Any(char.IsControl))
        {
            throw FieldError(field, $"Required, at most {maximum} characters, without control characters.");
        }

        return text;
    }

    private static AppException FieldError(string field, string message)
        => AppException.Validation("Invalid organization payload.", new Dictionary<string, string[]> { [field] = [message] });

    private static LocationDto ToDto(Location location) => new(location.Id, location.CompanyId, location.Name, location.Active);
    private static EmployeeDto ToDto(Employee employee)
        => new(employee.Id, employee.UserId, employee.EmployeeNumber, employee.Name, employee.LocationId, employee.Active);
}
