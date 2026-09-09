using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure;

namespace Susumu.Api.Tests;

public sealed class PhotoTests : ApiTestBase
{
    [Fact]
    public async Task A_declared_photo_is_stored_and_completes_the_inspection()
    {
        var client = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        var draft = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(inspectionId, CompleteItems(photoIds: [photoId]))));
        var draftResult = await draft.ReadAsync<SyncInspectionResponse>();

        Assert.Equal(PhotoUploadState.Pending, draftResult.PhotoUploadState);

        var (bytes, sha) = TestImages.Png("front-tyre");
        var response = await UploadAsync(client, inspectionId, photoId, bytes, sha, "image/png");
        var photo = await response.ReadAsync<PhotoDto>();

        Assert.True(photo.Uploaded);
        Assert.Equal(sha, photo.Sha256);
        Assert.Equal(bytes.Length, photo.SizeBytes);

        var inspection = await (await client.GetAsync($"/api/v1/inspections/{inspectionId}"))
            .ReadAsync<InspectionDto>();

        Assert.Equal(PhotoUploadState.Complete, inspection.PhotoUploadState);
        Assert.Contains(inspection.Photos!, p => p.Id == photoId && p.Uploaded);
        Assert.Contains(inspection.Items.SelectMany(i => i.PhotoIds ?? []), id => id == photoId);
    }

    [Fact]
    public async Task Retrying_the_same_upload_succeeds_without_duplicating_anything()
    {
        var client = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(client);
        var (bytes, sha) = TestImages.Png("retry");

        var first = await (await UploadAsync(client, inspectionId, photoId, bytes, sha, "image/png"))
            .ReadAsync<PhotoDto>();
        var second = await (await UploadAsync(client, inspectionId, photoId, bytes, sha, "image/png"))
            .ReadAsync<PhotoDto>();

        Assert.Equal(first.Sha256, second.Sha256);
        Assert.Equal(1, await App.WithDbAsync(db => db.Photos.CountAsync(p => p.Id == photoId)));
        Assert.Single(App.StoredPhotoFiles());
    }

    [Fact]
    public async Task Uploading_different_bytes_for_a_stored_photo_is_refused()
    {
        var client = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(client);

        var (original, originalSha) = TestImages.Png("original");
        await UploadAsync(client, inspectionId, photoId, original, originalSha, "image/png");

        var (replacement, replacementSha) = TestImages.Png("replacement");
        var response = await UploadAsync(client, inspectionId, photoId, replacement, replacementSha, "image/png");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var stored = await App.WithDbAsync(db => db.Photos.FirstAsync(p => p.Id == photoId));
        Assert.Equal(originalSha, stored.Sha256);

        var download = await client.GetAsync($"/api/v1/inspections/{inspectionId}/photos/{photoId}");
        Assert.Equal(original, await download.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task A_checksum_that_does_not_match_the_bytes_is_rejected_before_storage()
    {
        var client = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(client);
        var (bytes, _) = TestImages.Png("corrupt");

        var response = await UploadAsync(
            client, inspectionId, photoId, bytes, new string('a', 64), "image/png");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(App.StoredPhotoFiles());
    }

    [Fact]
    public async Task A_disallowed_content_type_is_rejected()
    {
        var client = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(client);
        var bytes = Encoding.UTF8.GetBytes("<svg/>");
        var sha = TestImages.Sha(bytes);

        var response = await UploadAsync(client, inspectionId, photoId, bytes, sha, "image/svg+xml");

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }

    [Fact]
    public async Task Content_that_does_not_match_the_declared_image_type_is_rejected()
    {
        var client = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(client);
        var bytes = Encoding.UTF8.GetBytes("MZ this is an executable, not a picture");
        var sha = TestImages.Sha(bytes);

        var response = await UploadAsync(client, inspectionId, photoId, bytes, sha, "image/png");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("not a usable", (await response.ReadProblemAsync()).Detail);
    }

    [Fact]
    public async Task An_oversized_attachment_is_refused()
    {
        var client = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(client);

        // The size gate runs before any structural parsing, so the content itself does not matter.
        var bytes = new byte[(15 * 1024 * 1024) + 1024];
        RandomNumberGenerator.Fill(bytes.AsSpan(0, 64));

        var response = await UploadAsync(client, inspectionId, photoId, bytes, TestImages.Sha(bytes), "image/png");

        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
    }

    [Fact]
    public async Task A_truncated_image_is_rejected_even_though_its_header_is_valid()
    {
        var client = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(client);
        var (bytes, sha) = TestImages.TruncatedPng("cut-short");

        var response = await UploadAsync(client, inspectionId, photoId, bytes, sha, "image/png");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("truncated", (await response.ReadProblemAsync()).Detail);
        Assert.Empty(App.StoredPhotoFiles());
    }

    [Fact]
    public async Task An_image_declaring_an_unreasonable_canvas_is_rejected()
    {
        var client = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(client);
        var (bytes, sha) = TestImages.OversizedPng();

        var response = await UploadAsync(client, inspectionId, photoId, bytes, sha, "image/png");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("pixels", (await response.ReadProblemAsync()).Detail);
    }

    [Fact]
    public async Task A_reviewer_cannot_upload_into_another_inspectors_inspection()
    {
        var owner = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(owner);

        var supervisor = await App.SignInAsync("supervisor");
        var (bytes, sha) = TestImages.Png("supervisor-takeover");
        var response = await UploadAsync(supervisor, inspectionId, photoId, bytes, sha, "image/png");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Identical_bytes_with_a_different_claimed_relationship_do_not_pass_as_a_retry()
    {
        var client = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(client);
        var (bytes, sha) = TestImages.Png("stable-association");

        await UploadAsync(client, inspectionId, photoId, bytes, sha, "image/png");

        var response = await UploadAsync(
            client, inspectionId, photoId, bytes, sha, "image/png", kind: PhotoKind.Annotation);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var stored = await App.WithDbAsync(db => db.Photos.FirstAsync(p => p.Id == photoId));
        Assert.Equal(PhotoKind.Original, stored.Kind);
    }

    [Fact]
    public async Task The_stored_path_comes_from_identifiers_and_ignores_the_client_filename()
    {
        var client = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(client);
        var (bytes, sha) = TestImages.Jpeg("path");

        await UploadAsync(client, inspectionId, photoId, bytes, sha, "image/jpeg",
            fileName: "../../../../evil.jpg");

        var stored = await App.WithDbAsync(db => db.Photos.FirstAsync(p => p.Id == photoId));

        // The object key is independent of the content type on purpose, so two concurrent uploads
        // that disagree about the format cannot write two files for one declared photo.
        Assert.Equal($"{Fixture.CompanyId:N}/{inspectionId:N}/{photoId:N}.bin", stored.StoragePath);
        Assert.True(File.Exists(Path.Combine(App.PhotoRoot, stored.StoragePath!.Replace('/', Path.DirectorySeparatorChar))));
    }

    [Fact]
    public async Task An_annotation_requires_an_existing_original_and_never_replaces_it()
    {
        var client = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var originalId = Guid.NewGuid();
        var annotationId = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                inspectionId, CompleteItems(photoIds: [originalId, annotationId]))));

        var (original, originalSha) = TestImages.Png("original-photo");
        await UploadAsync(client, inspectionId, originalId, original, originalSha, "image/png");

        var (annotation, annotationSha) = TestImages.Png("annotated-copy");
        var response = await UploadAsync(
            client, inspectionId, annotationId, annotation, annotationSha, "image/png",
            kind: PhotoKind.Annotation, originalPhotoId: originalId);

        var stored = await response.ReadAsync<PhotoDto>();
        Assert.Equal(PhotoKind.Annotation, stored.Kind);
        Assert.Equal(originalId, stored.OriginalPhotoId);

        var download = await client.GetAsync($"/api/v1/inspections/{inspectionId}/photos/{originalId}");
        Assert.Equal(original, await download.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task An_annotation_without_an_original_reference_is_rejected()
    {
        var client = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(client);
        var (bytes, sha) = TestImages.Png("orphan-annotation");

        var response = await UploadAsync(
            client, inspectionId, photoId, bytes, sha, "image/png", kind: PhotoKind.Annotation);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_photo_declared_before_finalization_can_still_be_uploaded_afterwards()
    {
        var client = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        var finalize = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                inspectionId, CompleteItems(photoIds: [photoId]), InspectionState.Finalized, odometerKm: 101_000)));

        var result = await finalize.ReadAsync<SyncInspectionResponse>();
        Assert.Equal(InspectionState.Finalized, result.State);
        Assert.Equal(PhotoUploadState.Pending, result.PhotoUploadState);

        var (bytes, sha) = TestImages.Png("late-upload");
        var upload = await UploadAsync(client, inspectionId, photoId, bytes, sha, "image/png");
        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);

        var inspection = await (await client.GetAsync($"/api/v1/inspections/{inspectionId}"))
            .ReadAsync<InspectionDto>();
        Assert.Equal(PhotoUploadState.Complete, inspection.PhotoUploadState);
    }

    [Fact]
    public async Task A_photo_that_was_not_declared_cannot_be_added_to_a_finalized_inspection()
    {
        var client = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(
                inspectionId, CompleteItems(), InspectionState.Finalized, odometerKm: 101_000)));

        var (bytes, sha) = TestImages.Png("sneaky");
        var response = await UploadAsync(client, inspectionId, Guid.NewGuid(), bytes, sha, "image/png");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Photos_are_not_readable_from_another_location()
    {
        var owner = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(owner);
        var (bytes, sha) = TestImages.Png("scoped");
        await UploadAsync(owner, inspectionId, photoId, bytes, sha, "image/png");

        var outsider = await App.SignInAsync("inspector-b", "tablet-b");
        var response = await outsider.GetAsync($"/api/v1/inspections/{inspectionId}/photos/{photoId}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Another_inspector_cannot_upload_into_someone_elses_inspection()
    {
        var owner = await App.SignInAsync("inspector");
        var (inspectionId, photoId) = await DeclareAsync(owner);

        var intruder = await App.SignInAsync("inspector2");
        var (bytes, sha) = TestImages.Png("intruder");
        var response = await UploadAsync(intruder, inspectionId, photoId, bytes, sha, "image/png");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Dropping_a_declaration_never_deletes_bytes_that_were_already_stored()
    {
        var client = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(inspectionId, CompleteItems(photoIds: [photoId]))));

        var (bytes, sha) = TestImages.Png("kept");
        await UploadAsync(client, inspectionId, photoId, bytes, sha, "image/png");

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(inspectionId, CompleteItems())));

        var stillThere = await App.WithDbAsync(db => db.Photos.AnyAsync(p => p.Id == photoId && p.Uploaded));
        Assert.True(stillThere);

        var download = await client.GetAsync($"/api/v1/inspections/{inspectionId}/photos/{photoId}");
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
    }

    [Fact]
    public async Task A_declaration_without_bytes_is_dropped_when_the_client_removes_it()
    {
        var client = await App.SignInAsync("inspector");
        var inspectionId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(inspectionId, CompleteItems(photoIds: [photoId]))));

        await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 1, Inspection(inspectionId, CompleteItems())));

        Assert.Equal(0, await App.WithDbAsync(db => db.Photos.CountAsync(p => p.Id == photoId)));
    }

    private async Task<(Guid InspectionId, Guid PhotoId)> DeclareAsync(HttpClient client)
    {
        var inspectionId = Guid.NewGuid();
        var photoId = Guid.NewGuid();

        var response = await client.PostJsonAsync("/api/v1/sync/inspections",
            Operation(Guid.NewGuid(), 0, Inspection(inspectionId, CompleteItems(photoIds: [photoId]))));

        response.EnsureSuccessStatusCode();
        return (inspectionId, photoId);
    }

    private static Task<HttpResponseMessage> UploadAsync(
        HttpClient client,
        Guid inspectionId,
        Guid photoId,
        byte[] bytes,
        string sha,
        string contentType,
        PhotoKind kind = PhotoKind.Original,
        Guid? originalPhotoId = null,
        string fileName = "capture.bin")
    {
        var metadata = new PhotoUploadMetadata(
            photoId, null, kind, originalPhotoId, contentType, sha, bytes.Length, DateTimeOffset.UtcNow);

        var content = new MultipartFormDataContent();
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType == "image/svg+xml" ? "image/svg+xml" : contentType);
        content.Add(file, "file", fileName);
        content.Add(new StringContent(JsonSerializer.Serialize(metadata, SusumuJson.Options)), "metadata");

        return client.PostAsync($"/api/v1/inspections/{inspectionId}/photos/{photoId}", content);
    }

}
