// Purpose: verifies the ministry completion additions through real local services, storage, cookies and CSRF.
// Main tests: Arabic twins on ministries, meetings, stock, opportunities and formation; office-only meeting times; a priest's roster
// removal (pinned interval, pending guard, leadership ended, rejoin, denials); person-to-account lookup; draft formation editing; HTTP routes.

using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryCompletionTests
{
    [Fact]
    public async Task Ministry_Arabic_twins_are_saved_as_typed_and_projected_while_older_records_return_null()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var plain = await s.MinistryAsync(open: false, publish: true);
        Assert.Null(plain.NameAr);
        Assert.Null(plain.MeetingTimes);

        s.Use();
        var draft = await s.Ministries.SaveAsync(s.Parish, null, new SaveMinistryDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated choir", NameAr = "  جوقة معزولة  ", Kind = "Choir",
            Purpose = "Isolated singing", PurposeAr = "ترنيم معزول", PublicInformation = "Isolated public text", PublicInformationAr = "نص عام معزول",
            EligibilityPolicyReference = "isolated reviewed group policy"
        }, default);
        Assert.Equal("جوقة معزولة", draft.NameAr);
        Assert.Equal("ترنيم معزول", draft.PurposeAr);
        // Never copied from one language into the other.
        var latinOnly = await s.Ministries.SaveAsync(s.Parish, null, new SaveMinistryDto
        {
            OperationId = Guid.NewGuid(), Name = "Isolated team", Kind = "Team", Purpose = "Isolated purpose"
        }, default);
        Assert.Null(latinOnly.NameAr);
        Assert.Null(latinOnly.PurposeAr);

        await s.ActAsync(draft.Id, "approve");
        await s.ActAsync(draft.Id, "publish");
        var listed = (await s.Ministries.PublicAsync(s.Parish, 25, null, default)).Items.Single(m => m.Id == draft.Id);
        Assert.Equal("جوقة معزولة", listed.NameAr);
        Assert.Equal("نص عام معزول", listed.PublicInformationAr);
        Assert.Null((await s.Ministries.PublicAsync(s.Parish, 25, null, default)).Items.Single(m => m.Id == plain.Id).NameAr);
    }

    [Fact]
    public async Task Meeting_times_are_office_maintained_on_draft_or_active_ministries_and_visible_to_members()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var group = await s.MinistryAsync();
        var member = await s.LinkedApplicantAsync(mfa: true);
        await s.ApplicationActionAsync(group.Id, (await s.ApplyAsync(group.Id, member.AccountId)).Id, "approve");

        var updated = await MeetingTimesAsync(s, group.Id, "Sundays after the 10:00 liturgy", "الأحد بعد قداس العاشرة");
        Assert.Equal("Sundays after the 10:00 liturgy", updated.MeetingTimes);
        Assert.Equal("الأحد بعد قداس العاشرة", updated.MeetingTimesAr);
        Assert.Equal("Active", updated.Status);

        // Editing the draft description keeps the meeting times; clearing stores null.
        f.As(member.AccountId, mfa: false);
        var info = await s.Ministries.MemberInfoAsync(s.Parish, group.Id, default);
        Assert.Equal("Sundays after the 10:00 liturgy", info.MeetingTimes);

        // A current leader without ministries.manage cannot change them, nor can a member.
        await AppointAsync(s, group.Id, member.AccountId, null);
        f.As(member.AccountId);
        await Assert.ThrowsAsync<DomainException>(() => MeetingTimesAsync(s, group.Id, "Leader edit", null, use: false));
        s.Use();
        var cleared = await MeetingTimesAsync(s, group.Id, " ", null);
        Assert.Null(cleared.MeetingTimes);

        // Stale versions and archived ministries are refused.
        s.Use();
        await Assert.ThrowsAnyAsync<Exception>(() => s.Ministries.SaveMeetingTimesAsync(s.Parish, group.Id,
            new SaveMeetingTimesDto { OperationId = Guid.NewGuid(), Version = "stale", MeetingTimes = "x" }, default));
        await s.ActAsync(group.Id, "archive");
        Assert.Equal("invalid_ministry_state", (await Assert.ThrowsAsync<DomainException>(() => MeetingTimesAsync(s, group.Id, "After archive", null))).Code);
    }

    [Fact]
    public async Task A_priest_ends_a_pinned_membership_interval_which_ends_linked_leadership_and_allows_a_later_rejoin()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f, extraPriestDuties: [Permissions.MinistriesResourcesManage]);
        var group = await s.MinistryAsync();
        var member = await s.LinkedApplicantAsync(mfa: true);
        await s.ApplicationActionAsync(group.Id, (await s.ApplyAsync(group.Id, member.AccountId)).Id, "approve");
        await AppointAsync(s, group.Id, member.AccountId, null);
        var custodian = await f.CreateVerifiedStaffAsync();
        await AppointAsync(s, group.Id, custodian, "resources.custody");
        var row = await MembershipAsync(f, s.Parish, group.Id, member.PersonId);

        // Neither a leader with duties nor the member may end a membership.
        f.As(custodian);
        await Assert.ThrowsAsync<DomainException>(() => EndAsync(s, group.Id, member.PersonId, row.JoinedAt, use: false));
        f.As(member.AccountId, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => EndAsync(s, group.Id, member.PersonId, row.JoinedAt, use: false));

        // The request pins the interval it reviewed.
        Assert.Equal("invalid_ministry_state", (await Assert.ThrowsAsync<DomainException>(() => EndAsync(s, group.Id, member.PersonId, row.JoinedAt.AddSeconds(-1)))).Code);
        await Assert.ThrowsAsync<DomainException>(() => EndAsync(s, group.Id, member.PersonId, row.JoinedAt, reason: " "));

        // A pending application must be resolved first.
        f.Clock.Now = f.Clock.Now.AddMinutes(5);
        var leave = await s.ApplyAsync(group.Id, member.AccountId, "Leave");
        Assert.Equal("invalid_ministry_state", (await Assert.ThrowsAsync<DomainException>(() => EndAsync(s, group.Id, member.PersonId, row.JoinedAt))).Code);
        await s.ApplicationActionAsync(group.Id, leave.Id, "decline");

        f.Clock.Now = f.Clock.Now.AddMinutes(5);
        var request = new EndMembershipDto { OperationId = Guid.NewGuid(), JoinedAt = row.JoinedAt, Reason = "Isolated private removal reason" };
        s.Use();
        var ended = await s.Applications.EndMembershipAsync(s.Parish, group.Id, member.PersonId, request, default);
        Assert.False(ended.Current);
        Assert.Equal(f.Clock.Now, ended.LeftAt);
        // A retry replays the same result.
        Assert.Equal(ended.LeftAt, (await s.Applications.EndMembershipAsync(s.Parish, group.Id, member.PersonId, request, default)).LeftAt);
        var roster = (await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default)).Items.Single(r => r.PersonId == member.PersonId);
        Assert.False(roster.Current);

        var stored = await MembershipAsync(f, s.Parish, group.Id, member.PersonId);
        var period = (await Records(f).ReadAsync<MinistryMembershipPeriod>(MinistryAccess.Scope(s.Parish), "ministryMembershipPeriod:" + stored.PeriodId, default))!.Value;
        Assert.Equal(request.OperationId.ToString("N"), period.RemovalId);
        var removal = (await Records(f).ReadAsync<MinistryMembershipRemoval>(MinistryAccess.Scope(s.Parish), "ministryMembershipRemoval:" + period.RemovalId, default))!.Value;
        Assert.DoesNotContain("Isolated private removal reason", removal.ProtectedReason);
        var leader = (await Records(f).ReadAsync<MinistryLeader>(MinistryAccess.Scope(s.Parish), "ministryLeader:" + group.Id + ":" + member.AccountId, default))!.Value;
        Assert.True(leader.Revoked);
        Assert.Equal(f.Clock.Now, leader.EndedAt);

        // An ended membership cannot be ended again, and the person can rejoin through a new reviewed application.
        await Assert.ThrowsAsync<DomainException>(() => EndAsync(s, group.Id, member.PersonId, row.JoinedAt));
        f.Clock.Now = f.Clock.Now.AddMinutes(5);
        var rejoin = await s.ApplyAsync(group.Id, member.AccountId);
        await s.ApplicationActionAsync(group.Id, rejoin.Id, "approve");
        s.Use();
        var rejoined = await s.Applications.RosterAsync(s.Parish, group.Id, 25, null, default);
        Assert.True(rejoined.Items.Single(r => r.PersonId == member.PersonId).Current);
    }

    [Fact]
    public async Task Person_to_account_lookup_needs_people_write_and_returns_only_an_active_reviewed_link()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var member = await s.LinkedApplicantAsync();
        s.Use();
        var link = await s.Links.GetByPersonAsync(s.Parish, member.PersonId, default);
        Assert.Equal(member.AccountId, link.Value.AccountId);
        Assert.False(string.IsNullOrEmpty(link.Version));
        await Assert.ThrowsAsync<DomainException>(() => s.Links.GetByPersonAsync(s.Parish, Guid.NewGuid().ToString("N"), default));
        f.As(member.AccountId, mfa: false);
        await Assert.ThrowsAnyAsync<Exception>(() => s.Links.GetByPersonAsync(s.Parish, member.PersonId, default));
    }

    [Fact]
    public async Task Draft_formation_programs_are_edited_in_place_with_Arabic_and_descriptions_until_approval()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f, extraPriestDuties: [Permissions.MinistriesFormationRecord, Permissions.MinistriesFormationReview]);
        var group = await s.MinistryAsync();
        var recorder = await f.CreateVerifiedStaffAsync();
        await AppointAsync(s, group.Id, recorder, "formation.record");
        var service = f.Services.GetRequiredService<MinistryFormationService>();
        f.As(recorder);
        var draft = await service.CreateProgramAsync(s.Parish, group.Id, new CreateFormationDto
        {
            OperationId = Guid.NewGuid(), Title = "Isolated program", TitleAr = "برنامج معزول",
            Milestones = [new() { Key = "basics", Title = "Foundations", TitleAr = "الأسس", Description = "Isolated goal", PrerequisiteKeys = [] }]
        }, default);
        Assert.Equal("برنامج معزول", draft.TitleAr);
        Assert.Equal("الأسس", draft.Milestones[0].TitleAr);
        Assert.Equal("Isolated goal", draft.Milestones[0].Description);
        Assert.Null(draft.Milestones[0].DescriptionAr);

        var update = new UpdateFormationDto
        {
            OperationId = Guid.NewGuid(), Version = await ProgramVersionAsync(f, s.Parish, draft.Id), Title = "Isolated program v1",
            Milestones =
            [
                new() { Key = "basics", Title = "Foundations", PrerequisiteKeys = [] },
                new() { Key = "service", Title = "Service practice", DescriptionAr = "هدف معزول", PrerequisiteKeys = ["basics"] }
            ]
        };
        var edited = await service.UpdateProgramAsync(s.Parish, group.Id, draft.Id, update, default);
        Assert.Equal("Isolated program v1", edited.Title);
        Assert.Null(edited.TitleAr);
        Assert.Equal(2, edited.Milestones.Length);
        Assert.Equal("هدف معزول", edited.Milestones[1].DescriptionAr);
        Assert.Equal(edited.Title, (await service.UpdateProgramAsync(s.Parish, group.Id, draft.Id, update, default)).Title);

        // Invalid prerequisites, stale versions and non-recorders are refused.
        await Assert.ThrowsAsync<DomainException>(() => service.UpdateProgramAsync(s.Parish, group.Id, draft.Id, new UpdateFormationDto
        {
            OperationId = Guid.NewGuid(), Version = update.Version, Title = "Bad",
            Milestones = [new() { Key = "late", Title = "Late", PrerequisiteKeys = ["missing"] }]
        }, default));
        var stranger = await f.CreateVerifiedStaffAsync();
        f.As(stranger);
        var draftVersion = await ProgramVersionAsync(f, s.Parish, draft.Id);
        await Assert.ThrowsAsync<DomainException>(() => service.UpdateProgramAsync(s.Parish, group.Id, draft.Id, new UpdateFormationDto
        {
            OperationId = Guid.NewGuid(), Version = draftVersion, Title = "Stranger", Milestones = update.Milestones
        }, default));

        // Once approved the revision is immutable.
        s.Use();
        await service.ActProgramAsync(s.Parish, group.Id, draft.Id, new FormationProgramActionDto
        {
            OperationId = Guid.NewGuid(), Version = await ProgramVersionAsync(f, s.Parish, draft.Id), Action = "approve", ApprovalReference = "Isolated approval"
        }, default);
        f.As(recorder);
        var approvedVersion = await ProgramVersionAsync(f, s.Parish, draft.Id);
        Assert.Equal("invalid_formation_state", (await Assert.ThrowsAsync<DomainException>(() => service.UpdateProgramAsync(s.Parish, group.Id, draft.Id, new UpdateFormationDto
        {
            OperationId = Guid.NewGuid(), Version = approvedVersion, Title = "After approval", Milestones = update.Milestones
        }, default))).Code);
    }

    [Fact]
    public async Task Stock_meeting_and_opportunity_Arabic_twins_round_trip_and_members_never_see_storage()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f, extraPriestDuties: [Permissions.MinistriesResourcesManage, Permissions.MinistriesVolunteersManage]);
        var group = await s.MinistryAsync();
        var member = await s.LinkedApplicantAsync();
        await s.ApplicationActionAsync(group.Id, (await s.ApplyAsync(group.Id, member.AccountId)).Id, "approve");
        var resources = f.Services.GetRequiredService<MinistryResourceService>();
        s.Use();
        var stock = await resources.SaveStockAsync(s.Parish, group.Id, null, new SaveStockDto
        {
            OperationId = Guid.NewGuid(), Name = "Hymnals", NameAr = "كتب ترانيم", Storage = "Isolated cupboard", StorageAr = "خزانة معزولة", Total = 3, Status = "Active"
        }, default);
        Assert.Equal("كتب ترانيم", stock.NameAr);
        Assert.Equal("خزانة معزولة", stock.StorageAr);
        var loan = await resources.RequestAsync(s.Parish, group.Id, new RequestLoanDto
        {
            OperationId = Guid.NewGuid(), StockId = Guid.Parse(stock.Id), Quantity = 1, PersonId = Guid.Parse(member.PersonId)
        }, default);
        Assert.Equal("كتب ترانيم", loan.StockNameAr);
        f.As(member.AccountId, mfa: false);
        var visible = Assert.Single((await resources.AvailableStockAsync(s.Parish, group.Id, 25, null, default)).Items).Value;
        Assert.Equal("كتب ترانيم", visible.NameAr);
        Assert.Null(visible.Storage);
        Assert.Null(visible.StorageAr);

        s.Use();
        var meeting = await f.Services.GetRequiredService<MinistryMeetingService>().SaveAsync(s.Parish, group.Id, null, new SaveMinistryMeetingDto
        {
            OperationId = Guid.NewGuid(), Title = "Isolated rehearsal", TitleAr = "تمرين معزول", StartsAt = f.Clock.Now.AddDays(1),
            EndsAt = f.Clock.Now.AddDays(1).AddHours(1), TimeZone = "UTC"
        }, default);
        Assert.Equal("تمرين معزول", meeting.TitleAr);
        Assert.Equal("تمرين معزول", (await f.Services.GetRequiredService<MinistryMeetingService>().GetAsync(s.Parish, group.Id, meeting.Id, default)).Value.TitleAr);

        var opportunity = await f.Services.GetRequiredService<MinistryVolunteerService>().CreateOpportunityAsync(s.Parish, group.Id, new SaveOpportunityDto
        {
            OperationId = Guid.NewGuid(), Title = "Isolated ushers", TitleAr = "مرشدون معزولون", Position = "Usher",
            StartsAt = f.Clock.Now.AddDays(2), EndsAt = f.Clock.Now.AddDays(2).AddHours(2), Capacity = 2
        }, default);
        Assert.Equal("مرشدون معزولون", opportunity.TitleAr);
    }

    [Fact]
    public async Task New_ministry_routes_require_identity_CSRF_and_the_right_capacity_over_HTTP()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(f);
        var group = await s.MinistryAsync();
        var member = await s.LinkedApplicantAsync();
        await s.ApplicationActionAsync(group.Id, (await s.ApplyAsync(group.Id, member.AccountId)).Id, "approve");
        var joined = (await MembershipAsync(f, s.Parish, group.Id, member.PersonId)).JoinedAt;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var anonymous = factory.Client();
        using var priest = factory.Client();
        using var applicant = factory.Client();
        var root = $"/api/parishes/{s.Parish}";
        var seat = $"{root}/ministries/{group.Id}";
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"{root}/person-account-links/by-person/{member.PersonId}")).StatusCode);

        await MinistryHttpTests.LoginAsync(priest, "other@fixture.example", mfa: true);
        priest.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        await MinistryHttpTests.LoginAsync(applicant, member.Username);

        var link = await MinistryHttpTests.ReadAsync<Versioned<PersonAccountLinkDto>>(await priest.GetAsync($"{root}/person-account-links/by-person/{member.PersonId}"));
        Assert.Equal(member.AccountId, link.Value.AccountId);
        Assert.False((await applicant.GetAsync($"{root}/person-account-links/by-person/{member.PersonId}")).IsSuccessStatusCode);

        var current = await MinistryHttpTests.ReadAsync<Versioned<MinistryDto>>(await priest.GetAsync(seat));
        var times = new SaveMeetingTimesDto { OperationId = Guid.NewGuid(), Version = current.Version, MeetingTimes = "Fridays 19:00", MeetingTimesAr = "الجمعة ١٩:٠٠" };
        priest.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.False((await priest.PutAsJsonAsync(seat + "/meeting-times", times)).IsSuccessStatusCode);
        await MinistryHttpTests.CsrfAsync(priest);
        Assert.False((await applicant.PutAsJsonAsync(seat + "/meeting-times", times)).IsSuccessStatusCode);
        Assert.Equal("الجمعة ١٩:٠٠", (await MinistryHttpTests.ReadAsync<MinistryDto>(await priest.PutAsJsonAsync(seat + "/meeting-times", times))).MeetingTimesAr);
        Assert.Equal(HttpStatusCode.BadRequest, (await priest.PutAsJsonAsync(seat + "/meeting-times",
            new SaveMeetingTimesDto { OperationId = Guid.NewGuid(), Version = current.Version, MeetingTimes = new string('x', 301) })).StatusCode);

        var end = new EndMembershipDto { OperationId = Guid.NewGuid(), JoinedAt = joined, Reason = "Isolated HTTP removal reason" };
        Assert.False((await applicant.PostAsJsonAsync($"{seat}/roster/{member.PersonId}/end", end)).IsSuccessStatusCode);
        var response = await priest.PostAsJsonAsync($"{seat}/roster/{member.PersonId}/end", end);
        var json = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, json);
        Assert.DoesNotContain("Isolated HTTP removal reason", json);
        Assert.False((await MinistryHttpTests.ReadAsync<MinistryMembershipDto>(await applicant.GetAsync(seat + "/membership/mine"))).Current);
    }

    private static async Task<MinistryDto> MeetingTimesAsync(MinistryScenario s, string ministry, string? text, string? textAr, bool use = true)
    {
        if (use) s.Use();
        var version = (await Records(s.Fixture).ReadAsync<Ministry>(MinistryAccess.Scope(s.Parish), "ministry:" + ministry, default))!.Version;
        return await s.Ministries.SaveMeetingTimesAsync(s.Parish, ministry,
            new SaveMeetingTimesDto { OperationId = Guid.NewGuid(), Version = version, MeetingTimes = text, MeetingTimesAr = textAr }, default);
    }

    private static async Task<MinistryMembershipDto> EndAsync(MinistryScenario s, string ministry, string person, DateTimeOffset joined,
        bool use = true, string reason = "Isolated removal reason")
    {
        if (use) s.Use();
        return await s.Applications.EndMembershipAsync(s.Parish, ministry, person,
            new EndMembershipDto { OperationId = Guid.NewGuid(), JoinedAt = joined, Reason = reason }, default);
    }

    private static async Task AppointAsync(MinistryScenario s, string ministry, string account, string? duty)
    {
        s.Use();
        await s.Fixture.Services.GetRequiredService<MinistryLeadershipService>().AppointAsync(s.Parish, ministry, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(), MinistryVersion = (await s.Ministries.GetAsync(s.Parish, ministry, default)).Version,
            AccountId = Guid.Parse(account), Role = "Leader", Duties = duty is null ? [] : [duty], StartsAt = s.Fixture.Clock.Now,
            EvidenceReference = "Isolated leadership appointment"
        }, default);
    }

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<MinistryMembership> MembershipAsync(LocalBackendFixture f, string parish, string ministry, string person)
        => (await Records(f).ReadAsync<MinistryMembership>(MinistryAccess.Scope(parish), MinistryAccess.MemberKey(ministry, person), default))!.Value;

    private static async Task<string> ProgramVersionAsync(LocalBackendFixture f, string parish, string program)
        => (await Records(f).ReadAsync<FormationProgram>(MinistryAccess.Scope(parish), "formationProgram:" + program, default))!.Version;

    private static IRecordTransactions Records(LocalBackendFixture f) => f.Services.GetRequiredService<IRecordTransactions>();
}
