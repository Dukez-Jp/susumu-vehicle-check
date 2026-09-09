using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Domain.Entities;

namespace Susumu.Infrastructure.Services;

public static class Mapping
{
    public static UserDto ToDto(this AppUser user) => new(
        user.Id, user.Name, user.Username, user.Role, user.CompanyId, user.LocationId, user.Active);

    public static VehicleDto ToDto(this Vehicle vehicle) => new(
        vehicle.Id, vehicle.InternalNumber, vehicle.Plate, vehicle.Type,
        vehicle.CompanyId, vehicle.LocationId, vehicle.CurrentOdometerKm, vehicle.Active);

    public static ChecklistTemplateDto ToDto(this ChecklistTemplate template) => new(
        template.Id,
        template.Name,
        template.VehicleType,
        template.Version,
        template.Published,
        template.RequiresSignature,
        template.Active,
        template.Sections
            .OrderBy(s => s.OrderIndex)
            .Select(s => new ChecklistSectionDto(
                s.Id,
                s.Title,
                s.Items
                    .OrderBy(i => i.OrderIndex)
                    // AllowedStatuses is projected exactly as stored: null stays null so a client that
                    // predates the field, or a template that never restricted its options, is unchanged.
                    .Select(i => new ChecklistItemDto(
                        i.Id, i.Label, i.ResponseType, i.Required, i.Unit, i.MinValue, i.MaxValue,
                        i.AllowedStatuses))
                    .ToList()))
            .ToList());

    public static PhotoDto ToDto(this PhotoRecord photo) => new(
        photo.Id, photo.InspectionId, photo.ItemId, photo.Kind, photo.OriginalPhotoId,
        photo.ContentType, photo.Sha256, photo.SizeBytes, photo.CreatedAt, photo.Uploaded);

    /// <summary>
    /// An inspection is only <c>Complete</c> once every declared attachment has verified bytes on the
    /// server. A finalized inspection with a missing photo stays <c>Pending</c> and must be reported so.
    /// </summary>
    public static PhotoUploadState UploadState(IEnumerable<PhotoRecord> photos)
        => photos.All(p => p.Uploaded) ? PhotoUploadState.Complete : PhotoUploadState.Pending;

    public static InspectionDto ToDto(
        this Inspection inspection, string? createdByName = null, Guid? supersededByInspectionId = null)
    {
        var photos = inspection.Photos.ToList();
        var photosByItem = photos
            .Where(p => p.ItemId is not null)
            .GroupBy(p => p.ItemId!.Value)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Guid>)g.Select(p => p.Id).OrderBy(id => id).ToList());

        var items = inspection.Items
            .OrderBy(i => i.ItemId)
            .Select(i => new InspectionItemDto(
                i.ItemId,
                i.Status,
                i.Value,
                i.Notes,
                photosByItem.TryGetValue(i.ItemId, out var ids) ? ids : []))
            .ToList();

        return new InspectionDto(
            inspection.Id,
            inspection.VehicleId,
            inspection.TemplateId,
            inspection.TemplateVersion,
            inspection.DeviceId,
            inspection.OdometerKm,
            inspection.State,
            inspection.StartedAt,
            inspection.FinalizedAt,
            items,
            inspection.Notes,
            inspection.SupersedesInspectionId,
            inspection.CorrectionReason,
            inspection.Version,
            inspection.SignaturePhotoId,
            inspection.CreatedByUserId,
            createdByName ?? inspection.CreatedBy?.Name,
            inspection.ReceivedAt,
            UploadState(photos),
            photos.OrderBy(p => p.CreatedAt).Select(ToDto).ToList(),
            supersededByInspectionId);
    }
}
