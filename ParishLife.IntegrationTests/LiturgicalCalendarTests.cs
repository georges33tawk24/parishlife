// Purpose: verifies authority-managed liturgical calendars and parish exceptions (X12) through real local services and storage.
// Main tests: only the current bishop drafts and approves; drafts and superseded/withdrawn versions are never public; one approved version per rite
// and year, changed only by a reviewed correction; versions, replays and validation hold; priests record exceptions only under a permitting approved
// calendar, and visitors see them flagged without internal reasons.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class LiturgicalCalendarTests
{
    private static readonly DateOnly Jan1 = new(2027, 1, 1);

    private static SaveLiturgicalCalendarDto Draft(string? version = null, bool exceptions = true, string? corrects = null, params LiturgicalEntryDto[] entries) => new()
    {
        OperationId = Guid.NewGuid(), Version = version, Rite = "Supplied rite label", Year = 2027, Source = "Isolated authority source reference",
        VersionLabel = corrects is null ? "v1" : "v2", ValidFrom = Jan1, ValidTo = new DateOnly(2027, 12, 31), AllowsParishExceptions = exceptions,
        CorrectsCalendarId = corrects is null ? null : Guid.Parse(corrects), CorrectionReason = corrects is null ? null : "Isolated reviewed correction",
        Entries = entries.Length > 0 ? entries :
        [
            new() { Date = new DateOnly(2027, 1, 6), Titles = new() { ["en"] = "Entry one", ["fr"] = "Entrée un", ["ar"] = "البند الأول" }, Rank = "Supplied rank", RankAr = "رتبة مزوّدة", DisplayColor = "#ffffff" },
            new() { Date = new DateOnly(2027, 2, 2), Titles = new() { ["en"] = "Entry two" } }
        ]
    };

    private static LiturgicalActionDto Act(string version, string action, string? reason = null) => new() { OperationId = Guid.NewGuid(), Version = version, Action = action, Reason = reason };

    private static async Task<(LocalBackendFixture F, StaffAppointmentScenario S, LiturgicalCalendarService L)> StartAsync()
    {
        var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await StaffAppointmentScenario.CreateAsync(f);
        return (f, s, f.Services.GetRequiredService<LiturgicalCalendarService>());
    }

    private static async Task<string> ApprovedAsync(LocalBackendFixture f, StaffAppointmentScenario s, LiturgicalCalendarService l, bool exceptions = true)
    {
        f.As(f.Nominee);
        var id = Guid.NewGuid().ToString("N");
        var draft = await l.SaveAsync(s.Organization, id, Draft(exceptions: exceptions), default);
        await l.ActAsync(s.Organization, id, Act(draft.Version, "approve"), default);
        return id;
    }

    [Fact]
    public async Task Only_bishop_approved_versions_are_public_and_corrections_supersede_them()
    {
        var (f, s, l) = await StartAsync();
        await using var _ = f;
        var range = (From: (DateOnly?)Jan1, To: (DateOnly?)new DateOnly(2027, 2, 28));
        Assert.Equal("NotPublished", (await l.PublicAsync(s.Parish, range.From, range.To, "en", default)).Status);

        var id = Guid.NewGuid().ToString("N");
        f.As(f.Other);
        await Assert.ThrowsAsync<DomainException>(() => l.SaveAsync(s.Organization, id, Draft(), default));
        f.As(f.Nominee);
        var request = Draft();
        var draft = await l.SaveAsync(s.Organization, id, request, default);
        Assert.Equal(draft.Version, (await l.SaveAsync(s.Organization, id, request, default)).Version);
        Assert.Equal("version_required", (await Assert.ThrowsAsync<DomainException>(() => l.SaveAsync(s.Organization, id, Draft(), default))).Code);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => l.SaveAsync(s.Organization, id, Draft("stale"), default))).Code);
        var outside = Draft(draft.Version, true, null, new LiturgicalEntryDto { Date = new DateOnly(2028, 1, 1), Titles = new() { ["en"] = "Outside" } });
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => l.SaveAsync(s.Organization, id, outside, default))).Code);
        var badColor = Draft(draft.Version, true, null, new LiturgicalEntryDto { Date = Jan1, Titles = new() { ["en"] = "Color" }, DisplayColor = "red" });
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => l.SaveAsync(s.Organization, id, badColor, default))).Code);
        Assert.Equal("NotPublished", (await l.PublicAsync(s.Parish, range.From, range.To, "en", default)).Status);

        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => l.ActAsync(s.Organization, id, Act("stale", "approve"), default))).Code);
        var approved = await l.ActAsync(s.Organization, id, Act(draft.Version, "approve", "Isolated authority approval"), default);
        Assert.Equal(("Approved", f.Nominee), (approved.Value.Status, approved.Value.ApprovedBy));
        Assert.Equal("invalid_liturgical_state", (await Assert.ThrowsAsync<DomainException>(() => l.SaveAsync(s.Organization, id, Draft(approved.Version), default))).Code);

        var french = await l.PublicAsync(s.Parish, range.From, range.To, "fr", default);
        Assert.Equal("Published", french.Status);
        Assert.Equal([("Entrée un", "fr"), ("Entry two", "en")], french.Days.Select(d => (d.Title, d.Language)).ToArray());
        Assert.Equal(("Supplied rite label", "Isolated authority source reference", "v1", "#FFFFFF", false),
            (french.Days[0].Rite, french.Days[0].Source, french.Days[0].CalendarVersion, french.Days[0].DisplayColor, french.Days[0].ParishException));
        // Arabic rank/season labels are the authority's own; a label it supplied only in Latin script has no Arabic twin.
        Assert.Equal(("Supplied rank", "رتبة مزوّدة", (string?)null), (french.Days[0].Rank, french.Days[0].RankAr, french.Days[0].SeasonAr));
        Assert.Null(french.Days[1].RankAr);
        Assert.Equal("رتبة مزوّدة", (await l.GetAsync(s.Organization, id, default)).Value.Entries[0].RankAr);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => l.PublicAsync(s.Parish, Jan1, Jan1.AddDays(400), "en", default))).Code);

        // A second, unrelated version for the same rite and year cannot also become current.
        var rival = Guid.NewGuid().ToString("N");
        var rivalDraft = await l.SaveAsync(s.Organization, rival, Draft(), default);
        Assert.Equal("invalid_liturgical_state", (await Assert.ThrowsAsync<DomainException>(() => l.ActAsync(s.Organization, rival, Act(rivalDraft.Version, "approve"), default))).Code);

        var correction = Guid.NewGuid().ToString("N");
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => l.SaveAsync(s.Organization, correction,
            new SaveLiturgicalCalendarDto { OperationId = Guid.NewGuid(), Rite = "Supplied rite label", Year = 2027, Source = "x", VersionLabel = "v2", ValidFrom = Jan1,
                ValidTo = new DateOnly(2027, 12, 31), AllowsParishExceptions = true, CorrectsCalendarId = Guid.Parse(id), Entries = [] }, default))).Code);
        var fixedDraft = await l.SaveAsync(s.Organization, correction,
            Draft(null, true, id, new LiturgicalEntryDto { Date = new DateOnly(2027, 1, 7), Titles = new() { ["en"] = "Corrected entry" } }), default);
        await l.ActAsync(s.Organization, correction, Act(fixedDraft.Version, "approve"), default);
        var old = await l.GetAsync(s.Organization, id, default);
        Assert.Equal(("Superseded", correction), (old.Value.Status, old.Value.SupersededBy));
        var corrected = await l.PublicAsync(s.Parish, range.From, range.To, "en", default);
        Assert.Equal(["Corrected entry"], corrected.Days.Select(d => d.Title).ToArray());

        var live = await l.GetAsync(s.Organization, correction, default);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => l.ActAsync(s.Organization, correction, Act(live.Version, "withdraw"), default))).Code);
        await l.ActAsync(s.Organization, correction, Act(live.Version, "withdraw", "Isolated withdrawal"), default);
        Assert.Equal("NotPublished", (await l.PublicAsync(s.Parish, range.From, range.To, "en", default)).Status);
        Assert.Equal(3, (await l.ListAsync(s.Organization, default)).Count);
    }

    [Fact]
    public async Task Priests_record_parish_exceptions_only_within_permitting_approved_calendars()
    {
        var (f, s, l) = await StartAsync();
        await using var _ = f;
        var calendar = await ApprovedAsync(f, s, l);
        var priest = await s.AcceptAsync(await s.InviteAsync(f.Other, allows: [Permissions.SchedulePublish]));
        var reader = await f.CreateVerifiedStaffAsync();
        var plain = await s.AcceptAsync(await s.InviteAsync(reader, allows: [Permissions.PeopleRead]));
        SaveLiturgicalExceptionDto Exception(DateOnly from, DateOnly? to = null, string? cal = null) => new()
        {
            OperationId = Guid.NewGuid(), CalendarId = Guid.Parse(cal ?? calendar), EffectiveFrom = from, EffectiveTo = to,
            Titles = new() { ["en"] = "Local observance" }, Reason = "Isolated private local reason"
        };

        f.AsAppointment(reader, plain.Id);
        await Assert.ThrowsAsync<DomainException>(() => l.RecordExceptionAsync(s.Parish, Exception(new DateOnly(2027, 3, 1)), default));
        f.AsRecovery(f.Other);
        await Assert.ThrowsAsync<DomainException>(() => l.RecordExceptionAsync(s.Parish, Exception(new DateOnly(2027, 3, 1)), default));

        f.AsAppointment(f.Other, priest.Id);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => l.RecordExceptionAsync(s.Parish, Exception(new DateOnly(2027, 12, 31), new DateOnly(2028, 1, 2)), default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => l.RecordExceptionAsync(s.Parish, Exception(new DateOnly(2027, 3, 1), new DateOnly(2027, 2, 1)), default))).Code);
        var request = Exception(new DateOnly(2027, 3, 1), new DateOnly(2027, 3, 2));
        var recorded = await l.RecordExceptionAsync(s.Parish, request, default);
        Assert.Equal(recorded.Value.Id, (await l.RecordExceptionAsync(s.Parish, request, default)).Value.Id);
        Assert.Single(await l.ExceptionsAsync(s.Parish, default));

        var view = await l.PublicAsync(s.Parish, new DateOnly(2027, 2, 28), new DateOnly(2027, 3, 3), "en", default);
        Assert.Equal([new DateOnly(2027, 3, 1), new DateOnly(2027, 3, 2)], view.Days.Select(d => d.Date).ToArray());
        Assert.All(view.Days, d => Assert.True(d.ParishException));
        Assert.DoesNotContain(typeof(PublicLiturgicalDayDto).GetProperties(), p => p.Name.Contains("Reason") || p.Name.Contains("By"));

        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => l.WithdrawExceptionAsync(s.Parish, recorded.Value.Id, Act("stale", "withdraw", "Isolated"), default))).Code);
        await l.WithdrawExceptionAsync(s.Parish, recorded.Value.Id, Act(recorded.Version, "withdraw", "Isolated withdrawal"), default);
        Assert.Empty((await l.PublicAsync(s.Parish, new DateOnly(2027, 2, 28), new DateOnly(2027, 3, 3), "en", default)).Days);

        // A calendar the authority approved without parish exceptions refuses them.
        f.As(f.Nominee);
        var rows = await l.ListAsync(s.Organization, default);
        var live = rows.Single(r => r.Value.Id == calendar);
        await l.ActAsync(s.Organization, calendar, Act(live.Version, "withdraw", "Isolated replacement"), default);
        var strict = await ApprovedAsync(f, s, l, exceptions: false);
        f.AsAppointment(f.Other, priest.Id);
        Assert.Equal("invalid_liturgical_state", (await Assert.ThrowsAsync<DomainException>(() => l.RecordExceptionAsync(s.Parish, Exception(new DateOnly(2027, 4, 1), cal: strict), default))).Code);
        Assert.Equal("invalid_liturgical_state", (await Assert.ThrowsAsync<DomainException>(() => l.RecordExceptionAsync(s.Parish, Exception(new DateOnly(2027, 4, 1)), default))).Code);
    }
}
