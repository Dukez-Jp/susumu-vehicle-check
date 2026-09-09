namespace Susumu.Domain.Contracts;

public sealed record VehicleTypeDto(Guid Id, string Code, string Name, bool Active);
public sealed record CreateVehicleTypeRequest(string? Code, string? Name);
public sealed record UpdateVehicleTypeRequest(string? Name, bool? Active);
