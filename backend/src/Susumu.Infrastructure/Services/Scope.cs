using Susumu.Domain.Entities;
using Susumu.Infrastructure.Security;

namespace Susumu.Infrastructure.Services;

/// <summary>
/// Every resource query starts from one of these filters. Administrators work across their company;
/// all other roles are confined to their own location.
/// </summary>
public static class Scope
{
    public static IQueryable<Vehicle> InScope(this IQueryable<Vehicle> query, CurrentUser actor)
        => actor.IsCompanyWide
            ? query.Where(v => v.CompanyId == actor.CompanyId)
            : query.Where(v => v.CompanyId == actor.CompanyId && v.LocationId == actor.LocationId);

    public static IQueryable<Inspection> InScope(this IQueryable<Inspection> query, CurrentUser actor)
        => actor.IsCompanyWide
            ? query.Where(i => i.CompanyId == actor.CompanyId)
            : query.Where(i => i.CompanyId == actor.CompanyId && i.LocationId == actor.LocationId);

    public static IQueryable<ChecklistTemplate> InScope(this IQueryable<ChecklistTemplate> query, CurrentUser actor)
        => query.Where(t => t.CompanyId == actor.CompanyId);

    public static IQueryable<AppUser> InScope(this IQueryable<AppUser> query, CurrentUser actor)
        => actor.IsCompanyWide
            ? query.Where(u => u.CompanyId == actor.CompanyId)
            : query.Where(u => u.CompanyId == actor.CompanyId && u.LocationId == actor.LocationId);
}
