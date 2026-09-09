using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure;

namespace Susumu.Api.Tests;

public sealed class AnnotationSyncRegressionTests : ApiTestBase
{
    [Theory]
    [InlineData(InspectionState.Draft)]
    [InlineData(InspectionState.Finalized)]
    public async Task Resending_item_photo_ids_after_annotation_upload_preserves_the_annotation(
        InspectionState nextState)
    {
        var client = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var originalId = Guid.NewGuid();
        var annotationId = Guid.NewGuid();
        var items = CompleteItems(photoIds: [originalId, annotationId]);

        var declared = await (await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(inspectionId, items))))
            .ReadAsync<SyncInspectionResponse>();
        Assert.Equal(1, declared.Version);

        var (original, originalSha) = TestImages.Png("annotation-sync-original");
        var (annotation, annotationSha) = TestImages.Png("annotation-sync-copy");
        await (await UploadAsync(client, inspectionId, originalId, original, originalSha,
            PhotoKind.Original, Fixture.RequiredStatusItemId)).ReadAsync<PhotoDto>();
        await (await UploadAsync(client, inspectionId, annotationId, annotation, annotationSha,
            PhotoKind.Annotation, Fixture.RequiredStatusItemId, originalId)).ReadAsync<PhotoDto>();

        // The tablet declares item photo IDs only; this does not reclassify an uploaded annotation.
        var request = Operation(Guid.NewGuid(), 1,
            Inspection(inspectionId, items, nextState, odometerKm: 101_000));
        var accepted = await (await client.PostJsonAsync("/api/v1/sync/inspections", request))
            .ReadAsync<SyncInspectionResponse>();
        Assert.Equal(2, accepted.Version);
        Assert.Equal(nextState, accepted.State);
        Assert.Equal(PhotoUploadState.Complete, accepted.PhotoUploadState);

        var replay = await (await client.PostJsonAsync("/api/v1/sync/inspections", request))
            .ReadAsync<SyncInspectionResponse>();
        Assert.Equal(accepted.Version, replay.Version);

        var stored = await ReadInspectionAsync(client, inspectionId);
        Assert.Equal(2, stored.Version);
        Assert.Equal(nextState, stored.State);
        AssertAnnotation(stored, annotationId, originalId, annotationSha);
        var originalPhoto = Assert.Single(stored.Photos!, p => p.Id == originalId);
        Assert.Equal(PhotoKind.Original, originalPhoto.Kind);
        Assert.Null(originalPhoto.OriginalPhotoId);
        Assert.Equal(originalSha, originalPhoto.Sha256);
        Assert.Equal(original, await client.GetByteArrayAsync(
            $"/api/v1/inspections/{inspectionId}/photos/{originalId}"));
        Assert.Equal(annotation, await client.GetByteArrayAsync(
            $"/api/v1/inspections/{inspectionId}/photos/{annotationId}"));
    }

    [Fact]
    public async Task Finalization_before_uploads_accepts_declared_annotation_and_signature_without_rebinding()
    {
        var client = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var originalId = Guid.NewGuid();
        var annotationId = Guid.NewGuid();
        var signatureId = Guid.NewGuid();
        var payload = Inspection(inspectionId, CompleteItems(photoIds: [originalId, annotationId]),
            InspectionState.Finalized, odometerKm: 101_000) with { SignaturePhotoId = signatureId };
        var request = Operation(Guid.NewGuid(), 0, payload);

        var accepted = await (await client.PostJsonAsync("/api/v1/sync/inspections", request))
            .ReadAsync<SyncInspectionResponse>();
        Assert.Equal(InspectionState.Finalized, accepted.State);
        Assert.Equal(PhotoUploadState.Pending, accepted.PhotoUploadState);

        var (original, originalSha) = TestImages.Png("late-original");
        var (annotation, annotationSha) = TestImages.Png("late-annotation");
        var (signature, signatureSha) = TestImages.Png("late-signature");
        await (await UploadAsync(client, inspectionId, originalId, original, originalSha,
            PhotoKind.Original, Fixture.RequiredStatusItemId)).ReadAsync<PhotoDto>();
        await (await UploadAsync(client, inspectionId, annotationId, annotation, annotationSha,
            PhotoKind.Annotation, Fixture.RequiredStatusItemId, originalId)).ReadAsync<PhotoDto>();
        Assert.Equal(PhotoUploadState.Pending, (await ReadInspectionAsync(client, inspectionId)).PhotoUploadState);
        await (await UploadAsync(client, inspectionId, signatureId, signature, signatureSha,
            PhotoKind.Signature)).ReadAsync<PhotoDto>();

        var replay = await (await client.PostJsonAsync("/api/v1/sync/inspections", request))
            .ReadAsync<SyncInspectionResponse>();
        Assert.Equal(accepted.Version, replay.Version);
        var stored = await ReadInspectionAsync(client, inspectionId);
        Assert.Equal(InspectionState.Finalized, stored.State);
        Assert.Equal(PhotoUploadState.Complete, stored.PhotoUploadState);
        AssertAnnotation(stored, annotationId, originalId, annotationSha);
        var storedSignature = Assert.Single(stored.Photos!, p => p.Id == signatureId);
        Assert.Equal(PhotoKind.Signature, storedSignature.Kind);
        Assert.Null(storedSignature.ItemId);
        Assert.Null(storedSignature.OriginalPhotoId);
    }

    [Fact]
    public async Task Annotation_resends_do_not_allow_item_rebinding_or_signature_item_conversion()
    {
        var client = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var originalId = Guid.NewGuid();
        var annotationId = Guid.NewGuid();
        var signatureId = Guid.NewGuid();
        var payload = Inspection(inspectionId, CompleteItems(photoIds: [originalId, annotationId]))
            with { SignaturePhotoId = signatureId };
        await (await client.PostJsonAsync("/api/v1/sync/inspections", Operation(Guid.NewGuid(), 0, payload)))
            .ReadAsync<SyncInspectionResponse>();

        var (original, originalSha) = TestImages.Png("binding-original");
        var (annotation, annotationSha) = TestImages.Png("binding-annotation");
        var (signature, signatureSha) = TestImages.Png("binding-signature");
        await (await UploadAsync(client, inspectionId, originalId, original, originalSha,
            PhotoKind.Original, Fixture.RequiredStatusItemId)).ReadAsync<PhotoDto>();
        await (await UploadAsync(client, inspectionId, annotationId, annotation, annotationSha,
            PhotoKind.Annotation, Fixture.RequiredStatusItemId, originalId)).ReadAsync<PhotoDto>();
        await (await UploadAsync(client, inspectionId, signatureId, signature, signatureSha,
            PhotoKind.Signature)).ReadAsync<PhotoDto>();

        var reboundItems = CompleteItems(photoIds: [originalId]).ToArray();
        reboundItems[1] = reboundItems[1] with { PhotoIds = [annotationId] };
        var rebound = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, payload with { Items = reboundItems }));
        Assert.Equal(HttpStatusCode.Conflict, rebound.StatusCode);
        Assert.Contains("another checklist item", (await rebound.ReadProblemAsync()).Detail);

        var itemToSignature = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, payload with
            {
                Items = CompleteItems(photoIds: [originalId]), SignaturePhotoId = annotationId,
            }));
        Assert.Equal(HttpStatusCode.Conflict, itemToSignature.StatusCode);
        Assert.Contains("cannot become Signature", (await itemToSignature.ReadProblemAsync()).Detail);

        var signatureToItem = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, payload with
            {
                Items = CompleteItems(photoIds: [originalId, signatureId]), SignaturePhotoId = null,
            }));
        Assert.Equal(HttpStatusCode.Conflict, signatureToItem.StatusCode);
        Assert.Contains("declared as Signature", (await signatureToItem.ReadProblemAsync()).Detail);

        var uploadRebind = await UploadAsync(client, inspectionId, annotationId, annotation, annotationSha,
            PhotoKind.Annotation, Fixture.RequiredMeasurementItemId, originalId);
        Assert.Equal(HttpStatusCode.Conflict, uploadRebind.StatusCode);
        var uploadReclassify = await UploadAsync(client, inspectionId, annotationId, annotation, annotationSha,
            PhotoKind.Original, Fixture.RequiredStatusItemId);
        Assert.Equal(HttpStatusCode.Conflict, uploadReclassify.StatusCode);

        var stored = await ReadInspectionAsync(client, inspectionId);
        Assert.Equal(1, stored.Version);
        Assert.Equal(signatureId, stored.SignaturePhotoId);
        AssertAnnotation(stored, annotationId, originalId, annotationSha);
        var storedSignature = Assert.Single(stored.Photos!, p => p.Id == signatureId);
        Assert.Equal(PhotoKind.Signature, storedSignature.Kind);
        Assert.Null(storedSignature.ItemId);
        Assert.Equal(3, App.StoredPhotoFiles().Count);
    }

    private void AssertAnnotation(InspectionDto inspection, Guid annotationId, Guid originalId, string sha)
    {
        var photo = Assert.Single(inspection.Photos!, p => p.Id == annotationId);
        Assert.Equal(PhotoKind.Annotation, photo.Kind);
        Assert.Equal(originalId, photo.OriginalPhotoId);
        Assert.Equal(Fixture.RequiredStatusItemId, photo.ItemId);
        Assert.Equal(sha, photo.Sha256);
        Assert.True(photo.Uploaded);
        Assert.Contains(annotationId, Assert.Single(inspection.Items,
            item => item.ItemId == Fixture.RequiredStatusItemId).PhotoIds!);
    }

    private static async Task<InspectionDto> ReadInspectionAsync(HttpClient client, Guid id)
        => await (await client.GetAsync($"/api/v1/inspections/{id}")).ReadAsync<InspectionDto>();

    // Same multipart contract as the existing PhotoTests/SignatureTests helpers, with explicit itemId.
    private static async Task<HttpResponseMessage> UploadAsync(
        HttpClient client, Guid inspectionId, Guid photoId, byte[] bytes, string sha,
        PhotoKind kind, Guid? itemId = null, Guid? originalPhotoId = null)
    {
        var metadata = new PhotoUploadMetadata(photoId, itemId, kind, originalPhotoId,
            "image/png", sha, bytes.Length, DateTimeOffset.UtcNow);
        using var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        content.Add(file, "file", "capture.png");
        content.Add(new StringContent(JsonSerializer.Serialize(metadata, SusumuJson.Options)), "metadata");
        return await client.PostAsync($"/api/v1/inspections/{inspectionId}/photos/{photoId}", content);
    }
}
