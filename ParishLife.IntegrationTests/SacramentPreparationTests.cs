// Purpose: verifies the sacrament preparation additions through real local services and storage: the office review of a received request,
// the parish's own preparation requirement lists and each case's checklist, priest-decided request amendments, Arabic twins, a celebrant
// person record, the register page and the request date, including the authorization denials for each.
// Main tests: office review, requirement lists and checklist with optional scheduling block, request amendments, bilingual registration facts.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.Sacraments;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class SacramentPreparationTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Secretary)
    {
        public SacramentService Service => F.Services.GetRequiredService<SacramentService>();
        public string Parish => Staff.Parish;
        public void Priest() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task Office_review_is_recorded_once_by_the_office_and_never_gates_the_priest()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var record = await OpenAsync(x, await PersonAsync(x));
        Assert.Equal(f.Clock.Now, record.CreatedAt);
        Assert.Equal(x.Secretary, record.CreatedBy);

        var stranger = await f.CreateVerifiedStaffAsync();
        f.As(stranger);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, record.Id, "office-review"));
        f.As(x.Secretary, false);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, record.Id, "office-review"))).Code);
        f.As(x.Secretary);
        var reviewed = await ActAsync(x, record.Id, "office-review", r => r.Reason = "Baptismal documents seen");
        Assert.Equal(("Received", x.Secretary, "Baptismal documents seen"), (reviewed.Status, reviewed.OfficeReviewedBy, reviewed.OfficeReviewNote));
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, record.Id, "office-review"))).Code);

        // A priest decides with or without a review.
        var unreviewed = await OpenAsync(x, await PersonAsync(x));
        x.Priest();
        Assert.Equal("Preparation", (await ActAsync(x, unreviewed.Id, "accept")).Status);
        Assert.Equal("Preparation", (await ActAsync(x, record.Id, "accept")).Status);
        f.As(x.Secretary);
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, unreviewed.Id, "office-review"))).Code);
    }

    [Fact]
    public async Task Requirement_lists_come_only_from_the_priest_and_each_case_keeps_its_own_checklist()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        // No built-in list: a case accepted before the parish saves one has an empty checklist.
        var early = await OpenAsync(x, await PersonAsync(x));
        x.Priest();
        Assert.Empty(await x.Service.RequirementSetsAsync(x.Parish, default));
        Assert.Empty((await ActAsync(x, early.Id, "accept")).Requirements);

        f.As(x.Secretary);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveRequirementSetAsync(x.Parish, Requirements(null, true), default));
        x.Priest();
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveRequirementSetAsync(x.Parish, new SaveRequirementSetDto
        {
            OperationId = Guid.NewGuid(), Sacrament = "Baptism", Items = [new RequirementItemDto { Key = "unnamed" }]
        }, default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveRequirementSetAsync(x.Parish, new SaveRequirementSetDto
        {
            OperationId = Guid.NewGuid(), Sacrament = "Baptism",
            Items = [new RequirementItemDto { Key = "same", Label = "One" }, new RequirementItemDto { Key = "same", LabelAr = "اثنان" }]
        }, default))).Code);
        var saved = await x.Service.SaveRequirementSetAsync(x.Parish, Requirements(null, true), default);
        Assert.Equal(["first", "second"], saved.Items.Select(i => i.Key));
        Assert.Equal("المتطلب الثاني", saved.Items[1].LabelAr);
        Assert.Null(saved.Items[1].Label);
        // A later save must send the current version.
        Assert.Equal("version_required", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SaveRequirementSetAsync(x.Parish, Requirements(null, true), default))).Code);
        f.As(x.Secretary);
        Assert.Equal("Baptism", Assert.Single(await x.Service.RequirementSetsAsync(x.Parish, default)).Sacrament);

        var record = await OpenAsync(x, await PersonAsync(x));
        x.Priest();
        var accepted = await ActAsync(x, record.Id, "accept");
        Assert.True(accepted.RequirementsBlockScheduling);
        Assert.All(accepted.Requirements, r => Assert.False(r.Met));
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => Schedule(x, record.Id))).Code);

        f.As(x.Secretary);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, record.Id, "requirement", r => { r.RequirementKey = "missing"; r.RequirementMet = true; }))).Code);
        var marked = await ActAsync(x, record.Id, "requirement", r => { r.RequirementKey = "first"; r.RequirementMet = true; r.Reason = "Seen at the office"; });
        var first = marked.Requirements.Single(r => r.Key == "first");
        Assert.Equal((true, x.Secretary, "Seen at the office"), (first.Met, first.RecordedBy, first.Note));
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => Schedule(x, record.Id))).Code);

        // A changed list reaches an existing case only when synchronized, keeping what was recorded for items that remain.
        x.Priest();
        await x.Service.SaveRequirementSetAsync(x.Parish, new SaveRequirementSetDto
        {
            OperationId = Guid.NewGuid(), Version = saved.Version, Sacrament = "Baptism", BlockSchedulingUntilMet = true,
            Items = [new RequirementItemDto { Key = "first", Label = "First requirement" }]
        }, default);
        f.As(x.Secretary);
        Assert.Equal(2, (await x.Service.GetAsync(x.Parish, record.Id, default)).Value.Requirements.Length);
        var synced = await ActAsync(x, record.Id, "sync-requirements");
        Assert.True(Assert.Single(synced.Requirements).Met);
        Assert.Equal("Scheduled", (await Schedule(x, record.Id)).Status);

        // Without the block, a date can be confirmed with items still open.
        x.Priest();
        var current = Assert.Single(await x.Service.RequirementSetsAsync(x.Parish, default));
        await x.Service.SaveRequirementSetAsync(x.Parish, Requirements(current.Version, false), default);
        var open = await OpenAsync(x, await PersonAsync(x));
        x.Priest();
        Assert.False((await ActAsync(x, open.Id, "accept")).RequirementsBlockScheduling);
        f.As(x.Secretary);
        Assert.Equal("Scheduled", (await Schedule(x, open.Id)).Status);
        // The early case keeps its empty checklist until synchronized.
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, early.Id, "requirement", r => { r.RequirementKey = "first"; r.RequirementMet = true; }))).Code);
        Assert.Equal(2, (await ActAsync(x, early.Id, "sync-requirements")).Requirements.Length);
    }

    [Fact]
    public async Task Request_amendments_change_the_accepted_request_only_when_a_priest_approves()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var record = await OpenAsync(x, await PersonAsync(x));
        f.As(x.Secretary);
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => Propose(x, record.Id))).Code);
        x.Priest();
        await ActAsync(x, record.Id, "accept");

        f.As(x.Secretary);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, record.Id, "propose-amendment", r => r.Reason = "Nothing to change"))).Code);
        var proposed = await Propose(x, record.Id);
        var pending = Assert.Single(proposed.RequestAmendments);
        Assert.Equal(("Pending", "2026-12-20", "Original Godparent"), (pending.Status, pending.TentativeDate, pending.PreviousFacts["godparent"]));
        Assert.Null(proposed.TentativeDate);
        Assert.Equal("Original Godparent", proposed.Facts["godparent"]);
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => Propose(x, record.Id))).Code);
        Assert.Equal("clergy_authority_required", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, record.Id, "approve-amendment"))).Code);

        x.Priest();
        var approved = await ActAsync(x, record.Id, "approve-amendment", r => r.Reason = "Agreed with the family");
        Assert.Equal(("2026-12-20", "Changed Godparent"), (approved.TentativeDate, approved.Facts["godparent"]));
        Assert.False(approved.Facts.ContainsKey("note"));
        Assert.Equal(("Approved", f.Other), (approved.RequestAmendments[0].Status, approved.RequestAmendments[0].DecidedBy));

        f.As(x.Secretary);
        await ActAsync(x, record.Id, "propose-amendment", r => { r.TentativeDate = "2027-01-10"; r.Reason = "Family asked again"; });
        x.Priest();
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, record.Id, "reject-amendment"))).Code);
        var rejected = await ActAsync(x, record.Id, "reject-amendment", r => r.Reason = "The parish calendar is full that day");
        Assert.Equal(("2026-12-20", "Rejected"), (rejected.TentativeDate, rejected.RequestAmendments[1].Status));
        Assert.Equal("invalid_sacrament_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, record.Id, "approve-amendment"))).Code);
        Assert.Contains(rejected.Timeline, s => s.Action == "reject-amendment" && s.Note == "The parish calendar is full that day");
    }

    [Fact]
    public async Task Arabic_twins_celebrant_person_and_register_page_are_kept_as_typed_and_reach_the_current_facts()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var celebrant = await PersonAsync(x);
        var record = await OpenAsync(x, await PersonAsync(x));
        x.Priest();
        await x.Service.SetPolicyAsync(x.Parish, new NumberingPolicyDto
        {
            OperationId = Guid.NewGuid(), Sacrament = "Baptism", Format = "B-{n}", PerYear = false, ApprovalReference = "Isolated numbering decision"
        }, default);
        await ActAsync(x, record.Id, "accept");
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, record.Id, "record-celebration", r =>
        {
            r.CelebratedAt = f.Clock.Now.AddHours(-1); r.CelebrantNameAr = "الكاهن المحتفل";
        }))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, record.Id, "record-celebration", r =>
        {
            r.CelebratedAt = f.Clock.Now.AddHours(-1); r.PlaceAr = "الكنيسة"; r.CelebrantPersonId = Guid.NewGuid();
        }))).Code);
        // Arabic alone satisfies the place and celebrant rules; nothing is copied into the Latin fields.
        var celebrated = await ActAsync(x, record.Id, "record-celebration", r =>
        {
            r.CelebratedAt = f.Clock.Now.AddHours(-1); r.PlaceAr = "الكنيسة"; r.CelebrantNameAr = "الكاهن المحتفل";
            r.CelebrantPersonId = Guid.Parse(celebrant); r.WitnessesAr = "العرّاب";
        });
        Assert.Equal((null, "الكنيسة", null, "الكاهن المحتفل", celebrant), (celebrated.Place, celebrated.PlaceAr, celebrated.CelebrantName, celebrated.CelebrantNameAr, celebrated.CelebrantPersonId));
        f.As(x.Secretary);
        await ActAsync(x, record.Id, "amend-facts", r => { r.Place = "Isolated church"; r.CelebrantName = "Isolated celebrant"; });
        x.Priest();
        var registered = await ActAsync(x, record.Id, "register", r => { r.BookReference = "Book 3"; r.RegisterPage = "41"; });
        Assert.Equal(("Book 3", "41"), (registered.BookReference, registered.RegisterPage));
        Assert.Equal(("الكنيسة", "Isolated church", "العرّاب", "41"),
            (registered.CurrentFacts["placeAr"], registered.CurrentFacts["place"], registered.CurrentFacts["witnessesAr"], registered.CurrentFacts["registerPage"]));

        // The Arabic spelling and the page are correctable like the other register facts.
        f.As(x.Secretary);
        var correction = await x.Service.ProposeCorrectionAsync(x.Parish, record.Id, new ProposeCorrectionDto
        {
            OperationId = Guid.NewGuid(), Field = "placeAr", NewValue = "كنيسة القرية", Reason = "Spelling", Evidence = "Bound register"
        }, default);
        x.Priest();
        await x.Service.DecideCorrectionAsync(x.Parish, correction.Id, new DecideCorrectionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync<SacramentCorrection>(x, "sacramentCorrection:" + correction.Id), Approve = true, Note = "Checked"
        }, default);
        var current = (await x.Service.GetAsync(x.Parish, record.Id, default)).Value;
        Assert.Equal(("كنيسة القرية", "الكنيسة"), (current.CurrentFacts["placeAr"], current.PlaceAr));
    }

    private static SaveRequirementSetDto Requirements(string? version, bool block) => new()
    {
        OperationId = Guid.NewGuid(), Version = version, Sacrament = "Baptism", BlockSchedulingUntilMet = block,
        Items = [new RequirementItemDto { Key = "first", Label = "First requirement" }, new RequirementItemDto { Key = "second", LabelAr = "المتطلب الثاني" }]
    };

    private static Task<SacramentRecordDto> Schedule(Setup x, string id)
        => ActAsync(x, id, "schedule", r => { r.ScheduledAt = x.F.Clock.Now.AddDays(10); r.CelebrantName = "Isolated celebrant"; });

    private static Task<SacramentRecordDto> Propose(Setup x, string id)
        => ActAsync(x, id, "propose-amendment", r =>
        {
            r.TentativeDate = "2026-12-20"; r.Facts = new() { ["godparent"] = "Changed Godparent", ["note"] = "" }; r.Reason = "The family asked for another date";
        });

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

    private static async Task<SacramentRecordDto> OpenAsync(Setup x, string person)
    {
        x.F.As(x.Secretary);
        return await x.Service.CreateAsync(x.Parish, new CreateSacramentDto
        {
            OperationId = Guid.NewGuid(), Sacrament = "Baptism", SubjectPersonId = Guid.Parse(person), Facts = new() { ["godparent"] = "Original Godparent" }
        }, default);
    }

    private static async Task<SacramentRecordDto> ActAsync(Setup x, string id, string action, Action<SacramentActionDto>? configure = null)
    {
        var request = new SacramentActionDto { OperationId = Guid.NewGuid(), Version = await VersionAsync<SacramentRecord>(x, "sacrament:" + id), Action = action };
        configure?.Invoke(request);
        return await x.Service.ActAsync(x.Parish, id, request, default);
    }

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync<T>(Setup x, string key)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<T>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, key, default))!.Version;
}
