// Purpose: verifies parish following, membership requests (A09/A10) and member profile corrections (A12) through real local services and storage.
// Main tests: follow/primary/unfollow preferences; one waiting request, return with an applicant-visible reason, duplicate-safe linking,
// stale decisions and create-person; evidence rules, field-by-field review applied atomically to the Person, and withdraw limits;
// single-use, replaceable, expiring person invitations (A11) whose conflicting claims go to office review.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MembershipTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment)
    {
        public MembershipService Service => F.Services.GetRequiredService<MembershipService>();
        public string Parish => Staff.Parish;
        public void Office() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task Following_and_primary_parish_are_personal_preferences()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await f.CreateVerifiedMemberAsync();
        f.As(member);
        Assert.Equal("invalid_membership_state", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SetPrimaryAsync(x.Parish, default))).Code);
        var followed = Assert.Single(await x.Service.FollowAsync(x.Parish, default));
        Assert.Equal(("Following", false), (followed.Relationship, followed.Primary));
        Assert.Single(await x.Service.FollowAsync(x.Parish, default));
        Assert.True(Assert.Single(await x.Service.SetPrimaryAsync(x.Parish, default)).Primary);
        Assert.Empty(await x.Service.UnfollowAsync(x.Parish, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Service.FollowAsync(Guid.NewGuid().ToString(), default));
    }

    [Fact]
    public async Task Membership_requests_are_reviewed_into_a_duplicate_safe_person_link()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var existing = await PersonAsync(x, "Applicant");
        var member = await f.CreateVerifiedMemberAsync();
        f.As(member);
        var submitted = await x.Service.RequestAsync(x.Parish, Apply("Applicant"), default);
        Assert.Null(submitted.ApplicantAccountId);
        Assert.Equal("Following", Assert.Single(await x.Service.MyParishesAsync(default)).Relationship);
        Assert.Equal("invalid_membership_state", (await Assert.ThrowsAsync<DomainException>(() => x.Service.RequestAsync(x.Parish, Apply("Applicant"), default))).Code);

        x.Office();
        var queued = Assert.Single(await x.Service.QueueAsync(x.Parish, default));
        Assert.Equal(member, queued.Value.ApplicantAccountId);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(x, submitted.Id, "return"))).Code);
        var returned = await DecideAsync(x, submitted.Id, "return", reason: "Please add the parish where you were baptized.");
        Assert.Equal("NeedsInformation", returned.Status);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Service.DecideAsync(x.Parish, submitted.Id, new MembershipDecisionDto
        {
            OperationId = Guid.NewGuid(), Version = queued.Version, Action = "decline", Reason = "Stale"
        }, default))).Code);
        Assert.Equal("invalid_membership_state", (await Assert.ThrowsAsync<DomainException>(() => DecideAsync(x, submitted.Id, "create-person", evidence: "Office identity check"))).Code);
        var linked = await DecideAsync(x, submitted.Id, "link", existing, "Office identity check");
        Assert.Equal(("Linked", existing), (linked.Status, linked.PersonId));

        f.As(member);
        Assert.Equal(2, (await f.Services.GetRequiredService<NotificationService>().ListAsync(null, 25, null, default)).Items.Count(n => n.Topic == "membership.decision"));
        var mine = Assert.Single(await x.Service.OwnRequestsAsync(x.Parish, default));
        Assert.Equal(("Linked", "Please add the parish where you were baptized.", (string?)null), (mine.Status, mine.ApplicantReason, mine.PersonId));
        Assert.Equal("Member", Assert.Single(await x.Service.MyParishesAsync(default)).Relationship);
        Assert.Equal("invalid_membership_state", (await Assert.ThrowsAsync<DomainException>(() => x.Service.RequestAsync(x.Parish, Apply("Applicant"), default))).Code);

        var newcomer = await f.CreateVerifiedMemberAsync();
        f.As(newcomer);
        var second = await x.Service.RequestAsync(x.Parish, Apply("Newcomer"), default);
        x.Office();
        var created = await DecideAsync(x, second.Id, "create-person", evidence: "Office identity check");
        Assert.Equal("Linked", created.Status);
        Assert.NotEqual(existing, created.PersonId);
        f.As(newcomer);
        Assert.Equal("invalid_membership_state", (await Assert.ThrowsAsync<DomainException>(() => x.Service.WithdrawRequestAsync(x.Parish, second.Id, default))).Code);
    }

    [Fact]
    public async Task Profile_corrections_need_evidence_and_are_applied_field_by_field()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await f.CreateVerifiedMemberAsync();
        f.As(member);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.ProposeCorrectionAsync(x.Parish, Correction(("Contact", "new@fixture.example", null)), default));
        var request = await x.Service.RequestAsync(x.Parish, Apply("Misspeled"), default);
        x.Office();
        var person = (await DecideAsync(x, request.Id, "create-person", evidence: "Office identity check")).PersonId!;

        f.As(member);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() =>
            x.Service.ProposeCorrectionAsync(x.Parish, Correction(("GivenName", "Misspelled", null)), default))).Code);
        var proposed = await x.Service.ProposeCorrectionAsync(x.Parish,
            Correction(("GivenName", "Misspelled", "Baptism certificate seen"), ("Contact", "new@fixture.example", null)), default);
        Assert.Equal("Misspeled", proposed.Fields.Single(c => c.Field == "GivenName").OldValue);
        Assert.Equal("invalid_membership_state", (await Assert.ThrowsAsync<DomainException>(() =>
            x.Service.ProposeCorrectionAsync(x.Parish, Correction(("Contact", "other@fixture.example", null)), default))).Code);

        x.Office();
        var pending = Assert.Single(await x.Service.CorrectionsAsync(x.Parish, false, default));
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() =>
            ReviewAsync(x, proposed.Id, pending.Version, ("GivenName", true, null), ("Contact", false, null)))).Code);
        var reviewed = await ReviewAsync(x, proposed.Id, pending.Version, ("GivenName", true, null), ("Contact", false, "Contact changes are made in your account settings."));
        Assert.Equal("Reviewed", reviewed.Status);
        var people = f.Services.GetRequiredService<PeopleService>();
        var stored = await people.GetAsync(x.Parish, person, default);
        Assert.Equal(("Misspelled", (string?)null), (stored.Value.GivenName, stored.Value.Contact));
        Assert.Empty(await x.Service.CorrectionsAsync(x.Parish, false, default));

        f.As(member);
        var mine = Assert.Single(await x.Service.CorrectionsAsync(x.Parish, true, default)).Value;
        Assert.Equal(("Approved", "Declined"), (mine.Fields.Single(c => c.Field == "GivenName").Decision, mine.Fields.Single(c => c.Field == "Contact").Decision));
        Assert.Equal("invalid_membership_state", (await Assert.ThrowsAsync<DomainException>(() => x.Service.WithdrawCorrectionAsync(x.Parish, proposed.Id, default))).Code);
        var again = await x.Service.ProposeCorrectionAsync(x.Parish, Correction(("Contact", "later@fixture.example", null)), default);
        Assert.Equal("Withdrawn", (await x.Service.WithdrawCorrectionAsync(x.Parish, again.Id, default)).Status);
    }

    [Fact]
    public async Task Person_invitations_are_single_use_replaceable_and_conflicts_go_to_review()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var invitations = f.Services.GetRequiredService<PersonInvitationService>();
        var person = await PersonAsync(x, "Invited");
        var other = await PersonAsync(x, "Other");
        var late = await PersonAsync(x, "Late");
        x.Office();
        var first = await invitations.CreateAsync(x.Parish, person, new CreatePersonInvitationDto { OperationId = Guid.NewGuid() }, default);
        var second = await invitations.CreateAsync(x.Parish, person, new CreatePersonInvitationDto { OperationId = Guid.NewGuid() }, default);
        Assert.Equal("NotSent", second.Delivery);
        Assert.Equal(f.Clock.Now.AddDays(7), second.ExpiresAt);
        var forOther = await invitations.CreateAsync(x.Parish, other, new CreatePersonInvitationDto { OperationId = Guid.NewGuid() }, default);
        var forLate = await invitations.CreateAsync(x.Parish, late, new CreatePersonInvitationDto { OperationId = Guid.NewGuid() }, default);

        var member = await f.CreateVerifiedMemberAsync();
        f.As(member);
        var revoked = await invitations.PreviewAsync(x.Parish, first.Id, first.Token, default);
        Assert.Equal(("Revoked", (string?)null), (revoked.Status, revoked.PersonName));
        await Assert.ThrowsAsync<DomainException>(() => invitations.PreviewAsync(x.Parish, second.Id, first.Token, default));
        Assert.Equal("Invited Isolated", (await invitations.PreviewAsync(x.Parish, second.Id, second.Token, default)).PersonName);
        Assert.Equal("invalid_invitation_state", (await Assert.ThrowsAsync<DomainException>(() => invitations.AcceptAsync(x.Parish, first.Id, first.Token, default))).Code);
        Assert.Equal("Used", (await invitations.AcceptAsync(x.Parish, second.Id, second.Token, default)).Status);
        Assert.Equal("Used", (await invitations.AcceptAsync(x.Parish, second.Id, second.Token, default)).Status);
        Assert.Equal(person, (await f.Services.GetRequiredService<MinistryPersonLinkService>().GetOwnAsync(x.Parish, default)).Value.PersonId);
        Assert.Equal("NeedsReview", (await invitations.AcceptAsync(x.Parish, forOther.Id, forOther.Token, default)).Status);

        x.Office();
        Assert.Equal("invalid_invitation_state", (await Assert.ThrowsAsync<DomainException>(() =>
            invitations.CreateAsync(x.Parish, person, new CreatePersonInvitationDto { OperationId = Guid.NewGuid() }, default))).Code);
        Assert.Equal("NeedsReview", Assert.Single(await invitations.ListAsync(x.Parish, other, default)).Value.Status);
        Assert.Contains((await f.Services.GetRequiredService<NotificationService>().ListAsync(null, 25, null, default)).Items, n => n.Topic == "person.invitation");

        f.Clock.Now = f.Clock.Now.AddDays(8);
        var newcomer = await f.CreateVerifiedMemberAsync();
        f.As(newcomer);
        Assert.Equal("Expired", (await invitations.PreviewAsync(x.Parish, forLate.Id, forLate.Token, default)).Status);
        Assert.Equal("invalid_invitation_state", (await Assert.ThrowsAsync<DomainException>(() => invitations.AcceptAsync(x.Parish, forLate.Id, forLate.Token, default))).Code);
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        return new Setup(f, staff, appointment.Id);
    }

    private static async Task<string> PersonAsync(Setup x, string name)
    {
        x.Office();
        return (await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = name, FamilyName = "Isolated", BirthDate = new DateOnly(1990, 5, 1)
        }, default)).Id;
    }

    private static RequestMembershipDto Apply(string name)
        => new() { OperationId = Guid.NewGuid(), GivenName = name, FamilyName = "Isolated", BirthDate = new DateOnly(1990, 5, 1), Locality = "Isolated town" };

    private static async Task<MembershipRequestDto> DecideAsync(Setup x, string id, string action, string? person = null, string? evidence = null, string? reason = null)
    {
        var row = (await x.Service.QueueAsync(x.Parish, default)).Single(r => r.Value.Id == id);
        return await x.Service.DecideAsync(x.Parish, id, new MembershipDecisionDto
        {
            OperationId = Guid.NewGuid(), Version = row.Version, Action = action, PersonId = person is null ? null : Guid.Parse(person),
            EvidenceReference = evidence, Reason = reason
        }, default);
    }

    private static ProposeProfileCorrectionDto Correction(params (string Field, string Value, string? Evidence)[] fields)
        => new() { OperationId = Guid.NewGuid(), Fields = fields.Select(c => new ProfileCorrectionFieldDto { Field = c.Field, NewValue = c.Value, Evidence = c.Evidence }).ToArray() };

    private static Task<ProfileCorrectionDto> ReviewAsync(Setup x, string id, string version, params (string Field, bool Approve, string? Reason)[] decisions)
        => x.Service.ReviewCorrectionAsync(x.Parish, id, new ReviewProfileCorrectionDto
        {
            OperationId = Guid.NewGuid(), Version = version, Decisions = decisions.Select(d => new FieldDecisionDto { Field = d.Field, Approve = d.Approve, Reason = d.Reason }).ToArray()
        }, default);
}
