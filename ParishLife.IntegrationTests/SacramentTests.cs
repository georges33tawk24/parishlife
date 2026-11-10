// Purpose: verifies sacramental cases and the official register (S12, S02.07) through real local services and storage.
// Main tests: acceptance by a priest or a secretary-recorded priest instruction; actual celebration before registration; priest-supplied
// numbering with sequential, never-reused numbers; returned entries; amendment-only corrections; pre-celebration decline and duplicates.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.Sacraments;
using ParishLife.Api.Services.Scheduling;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class SacramentTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Secretary)
    {
        public SacramentService Service => F.Services.GetRequiredService<SacramentService>();
        public string Parish => Staff.Parish;
        public void Priest() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task Cases_reach_the_register_only_after_actual_celebration_and_priest_registration_with_approved_numbering()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var first = await OpenAsync(x, await PersonAsync(x));
        f.As(x.Secretary);
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => x.Service.CreateAsync(x.Parish, Create(first.SubjectPersonId), default))).Code);
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, first.Id, "accept"))).Code);
        var accepted = await ActAsync(x, first.Id, "accept", r =>
        {
            r.InstructingPriestAccountId = Guid.Parse(f.Other);
            r.InstructionBasis = "Phone instruction from the parish priest";
            r.InstructionGivenAt = f.Clock.Now.AddHours(-2);
        });
        Assert.Equal("Preparation", accepted.Status);
        var step = accepted.Timeline.Last();
        Assert.Equal((x.Secretary, f.Other), (step.ActorAccountId, step.InstructingPriestAccountId));

        await ActAsync(x, first.Id, "schedule", r => { r.ScheduledAt = f.Clock.Now.AddDays(10); r.CelebrantName = "Isolated celebrant"; });
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => Celebrate(x, first.Id, f.Clock.Now.AddDays(10)))).Code);
        f.Clock.Now = f.Clock.Now.AddDays(11);
        await Celebrate(x, first.Id, f.Clock.Now.AddDays(-1));

        x.Priest();
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, first.Id, "register"))).Code);
        f.As(x.Secretary);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.SetPolicyAsync(x.Parish, Policy(), default));
        x.Priest();
        await x.Service.SetPolicyAsync(x.Parish, Policy(), default);
        await ActAsync(x, first.Id, "return-entry", r => r.Reason = "Godparent surname is misspelled");
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, first.Id, "register"));
        f.As(x.Secretary);
        await ActAsync(x, first.Id, "amend-facts", r => r.Facts = new() { ["godparent"] = "Isolated Godparent" });
        x.Priest();
        var registered = await ActAsync(x, first.Id, "register", r => r.BookReference = "Book 3, page 41");
        Assert.Equal(("Registered", "BAP-2026-1"), (registered.Status, registered.OfficialNumber));

        var second = await OpenAsync(x, await PersonAsync(x));
        x.Priest();
        await ActAsync(x, second.Id, "accept");
        await Celebrate(x, second.Id, f.Clock.Now.AddHours(-3));
        Assert.Equal("BAP-2026-2", (await ActAsync(x, second.Id, "register")).OfficialNumber);
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SetPolicyAsync(x.Parish, Policy("NEW-{n}"), default))).Code);
        Assert.Equal(2, (await x.Service.SearchAsync(x.Parish, "Baptism", "Registered", null, 25, null, default)).Items.Count);
    }

    [Fact]
    public async Task Registered_entries_change_only_through_priest_approved_amendments_that_keep_the_original()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var record = await OpenAsync(x, await PersonAsync(x));
        f.As(x.Secretary);
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => ProposeAsync(x, record.Id))).Code);
        x.Priest();
        await x.Service.SetPolicyAsync(x.Parish, Policy(), default);
        await ActAsync(x, record.Id, "accept");
        await Celebrate(x, record.Id, f.Clock.Now.AddHours(-1));
        await ActAsync(x, record.Id, "register");

        f.As(x.Secretary);
        var correction = await ProposeAsync(x, record.Id);
        Assert.Single(await x.Service.PendingCorrectionsAsync(x.Parish, default));
        await Assert.ThrowsAsync<DomainException>(() => DecideAsync(x, correction.Id, true));
        x.Priest();
        Assert.Equal("Approved", (await DecideAsync(x, correction.Id, true)).Status);
        var current = (await x.Service.GetAsync(x.Parish, record.Id, default)).Value;
        Assert.Equal("Original Godparent", current.Facts["godparent"]);
        Assert.Equal("Corrected Godparent", current.CurrentFacts["godparent"]);
        var amendment = Assert.Single(current.Amendments);
        Assert.Equal(("Original Godparent", x.Secretary, f.Other), (amendment.OldValue, amendment.ProposedBy, amendment.ApprovedBy));

        f.As(x.Secretary);
        var rejected = await ProposeAsync(x, record.Id, "place", "Elsewhere");
        x.Priest();
        Assert.Equal("Rejected", (await DecideAsync(x, rejected.Id, false)).Status);
        Assert.Equal("Isolated church", (await x.Service.GetAsync(x.Parish, record.Id, default)).Value.CurrentFacts["place"]);
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, record.Id, "cancel", r => r.Reason = "Erase it"))).Code);
    }

    [Fact]
    public async Task Only_pre_celebration_cases_are_declined_or_cancelled_with_a_reason()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var declined = await OpenAsync(x, await PersonAsync(x));
        x.Priest();
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, declined.Id, "decline"));
        Assert.Equal("Declined", (await ActAsync(x, declined.Id, "decline", r => r.Reason = "Received in another parish")).Status);
        var person = await PersonAsync(x);
        var replacement = await OpenAsync(x, person);
        x.Priest();
        await ActAsync(x, replacement.Id, "accept");
        await ActAsync(x, replacement.Id, "schedule", r => { r.ScheduledAt = f.Clock.Now.AddDays(5); r.CelebrantAccountId = Guid.Parse(f.Other); });
        Assert.Equal("Preparation", (await ActAsync(x, replacement.Id, "reschedule", r => r.Reason = "Family illness")).Status);
        Assert.Equal("Cancelled", (await ActAsync(x, replacement.Id, "cancel", r => r.Reason = "Family moved")).Status);
    }

    [Fact]
    public async Task Anniversaries_come_only_from_registered_dates_for_authorized_staff_or_the_person()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var person = await PersonAsync(x);
        var record = await OpenAsync(x, person);
        var pending = await OpenAsync(x, await PersonAsync(x));
        x.Priest();
        await x.Service.SetPolicyAsync(x.Parish, Policy(), default);
        await ActAsync(x, record.Id, "accept");
        var at = f.Clock.Now.AddHours(-1);
        await Celebrate(x, record.Id, at);
        await ActAsync(x, record.Id, "register");
        await ActAsync(x, pending.Id, "accept");
        await Celebrate(x, pending.Id, at);

        var date = DateOnly.FromDateTime(at.DateTime);
        Assert.Empty(await x.Service.AnniversariesAsync(x.Parish, date.AddDays(-3), 30, default));
        f.As(x.Secretary);
        var upcoming = Assert.Single(await x.Service.AnniversariesAsync(x.Parish, date.AddYears(1).AddDays(-5), 30, default));
        Assert.Equal((record.Id, "Baptism", date.AddYears(1), 1), (upcoming.RecordId, upcoming.Sacrament, upcoming.NextOn, upcoming.Years));
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Service.AnniversariesAsync(x.Parish, date, 120, default))).Code);

        var member = await f.CreateVerifiedMemberAsync();
        x.Priest();
        await f.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(x.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(member), PersonId = Guid.Parse(person), EvidenceReference = "Isolated reviewed identity"
        }, default);
        f.As(member);
        Assert.Equal(record.Id, Assert.Single(await x.Service.MyAnniversariesAsync(x.Parish, default)).RecordId);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.AnniversariesAsync(x.Parish, date, 30, default));
    }

    [Fact]
    public async Task Priest_and_member_schedules_show_only_their_own_dated_duties_and_export_as_icalendar()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var person = await PersonAsync(x);
        var record = await OpenAsync(x, person);
        var other = await OpenAsync(x, await PersonAsync(x));
        x.Priest();
        await ActAsync(x, record.Id, "accept");
        await ActAsync(x, record.Id, "schedule", r => { r.ScheduledAt = f.Clock.Now.AddDays(5); r.CelebrantAccountId = Guid.Parse(f.Other); });
        await ActAsync(x, other.Id, "accept");
        await ActAsync(x, other.Id, "schedule", r => { r.ScheduledAt = f.Clock.Now.AddDays(6); r.CelebrantName = "Visiting celebrant"; });
        var schedules = f.Services.GetRequiredService<ScheduleService>();
        var duty = Assert.Single(await schedules.PriestAsync(x.Parish, f.Clock.Now, f.Clock.Now.AddDays(30), default));
        Assert.Equal(("Sacrament", record.Id), (duty.Kind, duty.SourceId));
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => schedules.PriestAsync(x.Parish, f.Clock.Now, f.Clock.Now.AddDays(120), default))).Code);
        f.As(x.Secretary);
        await Assert.ThrowsAsync<DomainException>(() => schedules.PriestAsync(x.Parish, f.Clock.Now, f.Clock.Now.AddDays(30), default));

        var member = await f.CreateVerifiedMemberAsync();
        x.Priest();
        await f.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(x.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(member), PersonId = Guid.Parse(person), EvidenceReference = "Isolated reviewed identity"
        }, default);
        f.As(member);
        Assert.Empty(await schedules.MineAsync(f.Clock.Now, f.Clock.Now.AddDays(30), default));
        await f.Services.GetRequiredService<MembershipService>().FollowAsync(x.Parish, default);
        var mine = Assert.Single(await schedules.MineAsync(f.Clock.Now, f.Clock.Now.AddDays(30), default));
        Assert.Equal(record.Id, mine.SourceId);
        var ics = schedules.ToICalendar([mine]);
        Assert.StartsWith("BEGIN:VCALENDAR\r\n", ics, StringComparison.Ordinal);
        Assert.Contains("SUMMARY:Baptism — ", ics, StringComparison.Ordinal);
        Assert.Contains("DTSTART:" + mine.StartsAt.UtcDateTime.ToString("yyyyMMdd'T'HHmmss'Z'", System.Globalization.CultureInfo.InvariantCulture), ics, StringComparison.Ordinal);
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "sacraments"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.SacramentsRecord, Permissions.PeopleRead, Permissions.PeopleWrite]));
        var secretary = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(secretary), Allows = [Permissions.SacramentsRecord], StartsAt = f.Clock.Now
        }, default);
        return new Setup(f, staff, appointment.Id, secretary);
    }

    private static async Task<string> PersonAsync(Setup x)
    {
        x.Priest();
        return (await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Candidate", BirthDate = new DateOnly(2026, 6, 1)
        }, default)).Id;
    }

    private static CreateSacramentDto Create(string person) => new()
    {
        OperationId = Guid.NewGuid(), Sacrament = "Baptism", SubjectPersonId = Guid.Parse(person), Facts = new() { ["godparent"] = "Original Godparent" }
    };

    private static async Task<SacramentRecordDto> OpenAsync(Setup x, string person)
    {
        x.F.As(x.Secretary);
        return await x.Service.CreateAsync(x.Parish, Create(person), default);
    }

    private static NumberingPolicyDto Policy(string format = "BAP-{year}-{n}") => new()
    {
        OperationId = Guid.NewGuid(), Sacrament = "Baptism", Format = format, PerYear = true, ApprovalReference = "Isolated priest numbering decision"
    };

    // Uses the caller's identity: identities set inside an awaited helper do not flow back to the test.
    private static Task<SacramentRecordDto> Celebrate(Setup x, string id, DateTimeOffset at)
        => ActAsync(x, id, "record-celebration", r => { r.CelebratedAt = at; r.Place = "Isolated church"; r.CelebrantName = "Isolated celebrant"; });

    private static async Task<SacramentRecordDto> ActAsync(Setup x, string id, string action, Action<SacramentActionDto>? configure = null)
    {
        var request = new SacramentActionDto { OperationId = Guid.NewGuid(), Version = await VersionAsync<SacramentRecord>(x, "sacrament:" + id), Action = action };
        configure?.Invoke(request);
        return await x.Service.ActAsync(x.Parish, id, request, default);
    }

    private static Task<SacramentCorrectionDto> ProposeAsync(Setup x, string id, string field = "facts.godparent", string value = "Corrected Godparent")
        => x.Service.ProposeCorrectionAsync(x.Parish, id, new ProposeCorrectionDto
        {
            OperationId = Guid.NewGuid(), Field = field, NewValue = value, Reason = "Spelling error", Evidence = "Isolated baptismal certificate copy"
        }, default);

    private static async Task<SacramentCorrectionDto> DecideAsync(Setup x, string correction, bool approve)
        => await x.Service.DecideCorrectionAsync(x.Parish, correction, new DecideCorrectionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync<SacramentCorrection>(x, "sacramentCorrection:" + correction), Approve = approve, Note = "Isolated decision"
        }, default);

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync<T>(Setup x, string key)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<T>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, key, default))!.Version;
}
