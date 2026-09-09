namespace Susumu.Domain.Entities;

/// <summary>An administrative personnel record, independent of a login's lifecycle.</summary>
public sealed class Employee
{
    public Guid Id { get; set; }
    public Guid CompanyId { get; set; }
    public Guid LocationId { get; set; }
    public Guid? UserId { get; set; }
    public string EmployeeNumber { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool Active { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public int Version { get; set; }
}
