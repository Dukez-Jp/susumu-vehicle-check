namespace Susumu.Domain.Contracts;

public sealed record CompanyDto(Guid Id, string Name, bool Active);
public sealed record CompanyWriteRequest(string? Name);
public sealed record LocationDto(Guid Id, Guid CompanyId, string Name, bool Active);
public sealed record CreateLocationRequest(string? Name);
public sealed record UpdateLocationRequest(string? Name, bool? Active);
public sealed record EmployeeDto(
    Guid Id, Guid? UserId, string EmployeeNumber, string Name, Guid LocationId, bool Active);
public sealed record EmployeeWriteRequest(
    Guid? UserId, string? EmployeeNumber, string? Name, Guid? LocationId, bool? Active);
