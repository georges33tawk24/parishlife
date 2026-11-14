// Purpose: verifies the parish public profile, its photographs, the public projection and the public calendar feed (.ics) through real local
// services, isolated storage and HTTP.
// Main tests: drafts stay private until an explicit publish and unpublish removes the public copy; input validation; editor-only access (no
// permission, no MFA and recovery sessions are refused); clergy only from current priest appointments and only when the parish lists them;
// photos are private until published and served anonymously only while published; the feed holds only published public events, escapes text
// and is cacheable; anonymous HTTP reads and refusals.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Publishing;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class ParishProfileTests
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4, 5];

    // The caller must then act as the editor itself: the request context is async-local and does not flow out of this helper.
    private static async Task<(StaffAppointmentScenario Staff, string Appointment)> EditorAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PublishingManage]));
        return (staff, appointment.Id);
    }

    private static ParishProfileContentDto Content(string massTimes = "Sunday 10:00", bool clergy = false) => new()
    {
        NameAr = "رعية الاختبار", LocalityAr = "بلدة الاختبار", Rite = "Fixture rite", Phone = "+961 1 000 000", Email = "office@parish.test",
        Address = "Fixture street\nFixture town", MassTimes = massTimes, MassTimesAr = "الأحد ١٠:٠٠", FeastDate = "07-20",
        LivestreamUrl = "https://video.parish.test/live", WhatsAppUrl = "https://chat.whatsapp.com/fixture", ShowClergy = clergy
    };

    private static Task<Versioned<ParishProfileDto>> SaveAsync(ParishProfileService s, string parish, string? version, ParishProfileContentDto content)
        => s.SaveAsync(parish, new SaveParishProfileDto { OperationId = Guid.NewGuid(), Version = version, Profile = content }, default);

    private static Task<Versioned<ParishProfileDto>> ActAsync(ParishProfileService s, string parish, string version, string action)
        => s.ActAsync(parish, new ParishProfileActionDto { OperationId = Guid.NewGuid(), Version = version, Action = action }, default);

    [Fact]
    public async Task Profile_is_public_only_after_an_explicit_publish_and_only_as_published()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var (staff, appointment) = await EditorAsync(f);
        f.AsAppointment(f.Other, appointment);
        var service = f.Services.GetRequiredService<ParishProfileService>();
        var directory = f.Services.GetRequiredService<PublicDirectoryService>();

        var empty = await service.GetAsync(staff.Parish, default);
        Assert.Equal(("NotPublished", string.Empty), (empty.Value.Status, empty.Version));
        Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => service.PublicAsync(staff.Parish, default))).Code);

        var saved = await SaveAsync(service, staff.Parish, null, Content());
        Assert.Equal(("NotPublished", "رعية الاختبار", "Fixture street\nFixture town"), (saved.Value.Status, saved.Value.Draft.NameAr, saved.Value.Draft.Address));
        Assert.Null(saved.Value.Draft.RiteAr); // an Arabic twin is never filled from the Latin field
        Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => service.PublicAsync(staff.Parish, default))).Code);
        Assert.Null((await directory.BrowseAsync(null, default)).Items.Single(p => p.ParishId == staff.Parish).NameAr);
        Assert.Equal("version_required", (await Assert.ThrowsAsync<DomainException>(() => SaveAsync(service, staff.Parish, null, Content()))).Code);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => SaveAsync(service, staff.Parish, "\"stale\"", Content()))).Code);

        var published = await ActAsync(service, staff.Parish, saved.Version, "publish");
        Assert.Equal(("Published", f.Other), (published.Value.Status, published.Value.PublishedBy));
        var visible = await service.PublicAsync(staff.Parish, default);
        Assert.Equal(("Isolated parish", "Sunday 10:00", "+961 1 000 000", "07-20"), (visible.Name, visible.Profile.MassTimes, visible.Profile.Phone, visible.Profile.FeastDate));
        Assert.Equal("/api/public/parishes/" + staff.Parish + "/calendar.ics", visible.CalendarFeed);
        Assert.Empty(visible.Clergy);
        // The private registration contact and editor identities never reach visitors.
        var json = JsonSerializer.Serialize(visible);
        Assert.DoesNotContain("fixture.example", json);
        Assert.DoesNotContain(f.Other, json);
        var card = (await directory.BrowseAsync("بلدة", default)).Items.Single();
        Assert.Equal((staff.Parish, "رعية الاختبار", "بلدة الاختبار"), (card.ParishId, card.NameAr, card.LocalityAr));
        Assert.Equal("/api/public/parishes/" + staff.Parish + "/profile", card.Links.Profile);

        // A new draft never changes the published copy until it is published.
        f.AsAppointment(f.Other, appointment);
        var draft = await SaveAsync(service, staff.Parish, published.Version, Content("Sunday 11:00", clergy: true));
        Assert.Equal("PublishedWithChanges", draft.Value.Status);
        Assert.Equal("Sunday 10:00", (await service.PublicAsync(staff.Parish, default)).Profile.MassTimes);
        var again = await ActAsync(service, staff.Parish, draft.Version, "publish");
        visible = await service.PublicAsync(staff.Parish, default);
        Assert.Equal("Sunday 11:00", visible.Profile.MassTimes);
        var priest = Assert.Single(visible.Clergy);
        Assert.Equal("Priest", priest.Role);
        Assert.False(string.IsNullOrWhiteSpace(priest.Name));

        var removed = await ActAsync(service, staff.Parish, again.Version, "unpublish");
        Assert.Equal(("NotPublished", "Sunday 11:00"), (removed.Value.Status, removed.Value.Draft.MassTimes));
        Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => service.PublicAsync(staff.Parish, default))).Code);
        Assert.Equal("invalid_profile_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(service, staff.Parish, removed.Version, "unpublish"))).Code);
    }

    [Fact]
    public async Task Profile_input_is_validated_and_only_editors_with_mfa_may_change_it()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var (staff, appointment) = await EditorAsync(f);
        f.AsAppointment(f.Other, appointment);
        var service = f.Services.GetRequiredService<ParishProfileService>();

        foreach (var bad in new Action<ParishProfileContentDto>[]
        {
            c => c.WhatsAppUrl = "https://elsewhere.test/group", c => c.LivestreamUrl = "http://video.parish.test/live", c => c.FeastDate = "02-30",
            c => c.Email = "not an email", c => c.Phone = "call the office", c => c.Website = "javascript:alert(1)", c => c.Rite = "two\nlines"
        })
        {
            var content = Content();
            bad(content);
            Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => SaveAsync(service, staff.Parish, null, content))).Code);
        }
        Assert.Equal("invalid_profile_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(service, staff.Parish, "\"none\"", "publish"))).Code);
        var saved = await SaveAsync(service, staff.Parish, null, new ParishProfileContentDto { MassTimes = "  ", Rite = " Fixture rite " });
        Assert.Equal((null, "Fixture rite"), (saved.Value.Draft.MassTimes, saved.Value.Draft.Rite));

        var outsider = await f.CreateVerifiedStaffAsync();
        f.As(outsider);
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(staff.Parish, default));
        await Assert.ThrowsAsync<DomainException>(() => SaveAsync(service, staff.Parish, saved.Version, Content()));
        f.As(f.Other, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(staff.Parish, default));
        f.AsRecovery(f.Other);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(service, staff.Parish, saved.Version, "publish"));
        f.AsAppointment(f.Other, appointment);
        Assert.Equal("NotPublished", (await service.GetAsync(staff.Parish, default)).Value.Status);
    }

    [Fact]
    public async Task Photos_stay_private_until_published_and_are_served_only_while_published()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var (staff, appointment) = await EditorAsync(f);
        f.AsAppointment(f.Other, appointment);
        var service = f.Services.GetRequiredService<ParishProfileService>();

        Assert.Equal("invalid_file", (await Assert.ThrowsAsync<DomainException>(() =>
            service.UploadPhotoAsync(staff.Parish, Guid.NewGuid(), "image/jpeg", Png, null, null, default))).Code);
        Assert.Equal("invalid_file", (await Assert.ThrowsAsync<DomainException>(() =>
            service.UploadPhotoAsync(staff.Parish, Guid.NewGuid(), "application/pdf", "%PDF-1.4"u8.ToArray(), null, null, default))).Code);
        var operation = Guid.NewGuid();
        var photo = await service.UploadPhotoAsync(staff.Parish, operation, "image/png", Png, "The nave", "صحن الكنيسة", default);
        Assert.Equal(("Private", (string?)null), (photo.Status, photo.PublicUrl));
        Assert.Equal(photo.Id, (await service.UploadPhotoAsync(staff.Parish, operation, "image/png", Png, "The nave", "صحن الكنيسة", default)).Id);
        Assert.Equal(Png, (await service.DownloadPhotoAsync(staff.Parish, photo.Id, default)).Content);
        Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => service.PublicPhotoAsync(staff.Parish, photo.Id, default))).Code);

        photo = await service.PhotoActAsync(staff.Parish, photo.Id, new ParishProfilePhotoActionDto { OperationId = Guid.NewGuid(), Version = photo.Version, Action = "publish" }, default);
        Assert.Equal("/api/public/parishes/" + staff.Parish + "/profile/photos/" + photo.Id, photo.PublicUrl);
        var served = await service.PublicPhotoAsync(staff.Parish, photo.Id, default);
        Assert.Equal(("image/png", Png.Length), (served.ContentType, served.Content.Length));
        Assert.Equal(Png, served.Content);
        var saved = await SaveAsync(service, staff.Parish, null, Content());
        await ActAsync(service, staff.Parish, saved.Version, "publish");
        var listed = Assert.Single((await service.PublicAsync(staff.Parish, default)).Photos);
        Assert.Equal((photo.PublicUrl, "صحن الكنيسة"), (listed.Url, listed.CaptionAr));

        photo = await service.PhotoActAsync(staff.Parish, photo.Id, new ParishProfilePhotoActionDto { OperationId = Guid.NewGuid(), Version = photo.Version, Action = "remove" }, default);
        Assert.Equal("Removed", photo.Status);
        Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => service.PublicPhotoAsync(staff.Parish, photo.Id, default))).Code);
        Assert.Empty((await service.PublicAsync(staff.Parish, default)).Photos);
        Assert.Equal("invalid_file_state", (await Assert.ThrowsAsync<DomainException>(() => service.PhotoActAsync(staff.Parish, photo.Id,
            new ParishProfilePhotoActionDto { OperationId = Guid.NewGuid(), Version = photo.Version, Action = "publish" }, default))).Code);

        f.As(await f.CreateVerifiedStaffAsync());
        await Assert.ThrowsAsync<DomainException>(() => service.DownloadPhotoAsync(staff.Parish, photo.Id, default));
        await Assert.ThrowsAsync<DomainException>(() => service.UploadPhotoAsync(staff.Parish, Guid.NewGuid(), "image/png", Png, null, null, default));
    }

    [Fact]
    public async Task Calendar_feed_holds_only_published_public_events_with_escaped_text()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await SchedulingScenario.CreateAsync(f);
        var shown = await s.EventAsync(visibility: "Public", title: "Feast, procession; vigil");
        await s.EventActionAsync(shown.Id, "confirm");
        await s.EventActionAsync(shown.Id, "publish");
        var unpublished = await s.EventAsync(visibility: "Public", title: "Not yet published");
        await s.EventActionAsync(unpublished.Id, "confirm");
        await s.EventAsync(visibility: "Parish", title: "Members only meeting");

        var feed = await f.Services.GetRequiredService<ParishCalendarFeedService>().FeedAsync(s.Parish, default);
        Assert.StartsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n", feed);
        Assert.EndsWith("END:VCALENDAR\r\n", feed);
        Assert.Contains("SUMMARY:Feast\\, procession\\; vigil\r\n", feed);
        Assert.Contains("UID:" + shown.Id + "@parishlife\r\n", feed);
        Assert.Contains("STATUS:CONFIRMED", feed);
        Assert.DoesNotContain("Not yet published", feed);
        Assert.DoesNotContain("Members only", feed);
        Assert.Equal(1, feed.Split("BEGIN:VEVENT").Length - 1);
        Assert.All(feed.Split("\r\n"), line => Assert.True(System.Text.Encoding.UTF8.GetByteCount(line) <= 75));
        Assert.Equal("a\\\\b\\nc", ParishCalendarFeedService.Escape("a\\b\r\nc"));
        Assert.Equal(new string('x', 75) + "\r\n xxxxé", ParishCalendarFeedService.Fold(new string('x', 79) + "é"));
    }

    [Fact]
    public async Task Anonymous_http_reads_serve_only_published_content_and_refuse_editor_routes()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var (staff, appointment) = await EditorAsync(f);
        f.AsAppointment(f.Other, appointment);
        var service = f.Services.GetRequiredService<ParishProfileService>();
        var photo = await service.UploadPhotoAsync(staff.Parish, Guid.NewGuid(), "image/png", Png, null, null, default);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        var client = factory.Client();

        var missing = await client.GetAsync("/api/public/parishes/" + staff.Parish + "/profile");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.True(missing.Headers.CacheControl!.NoStore);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/public/parishes/" + staff.Parish + "/profile/photos/" + photo.Id)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/parishes/" + staff.Parish + "/profile")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/parishes/" + staff.Parish + "/profile/photos/" + photo.Id)).StatusCode);

        var saved = await SaveAsync(service, staff.Parish, null, Content());
        await ActAsync(service, staff.Parish, saved.Version, "publish");
        await service.PhotoActAsync(staff.Parish, photo.Id, new ParishProfilePhotoActionDto { OperationId = Guid.NewGuid(), Version = photo.Version, Action = "publish" }, default);

        var read = await client.GetAsync("/api/public/parishes/" + staff.Parish + "/profile");
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        Assert.Equal("public, max-age=300", read.Headers.CacheControl!.ToString());
        var body = await read.Content.ReadFromJsonAsync<PublicParishProfileDto>();
        Assert.Equal(("رعية الاختبار", 1), (body!.Profile.NameAr, body.Photos.Length));
        var image = await client.GetAsync(body.Photos[0].Url);
        Assert.Equal("image/png", image.Content.Headers.ContentType!.MediaType);
        Assert.Equal(Png, await image.Content.ReadAsByteArrayAsync());
        Assert.Equal("public, max-age=300", image.Headers.CacheControl!.ToString());

        var feed = await client.GetAsync("/api/public/parishes/" + staff.Parish + "/calendar.ics");
        Assert.Equal(HttpStatusCode.OK, feed.StatusCode);
        Assert.Equal("text/calendar", feed.Content.Headers.ContentType!.MediaType);
        Assert.Equal("public, max-age=900", feed.Headers.CacheControl!.ToString());
        Assert.StartsWith("BEGIN:VCALENDAR", await feed.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/public/parishes/" + Guid.NewGuid().ToString("N") + "/calendar.ics")).StatusCode);
    }
}
