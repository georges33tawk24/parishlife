// Purpose: verifies exact-message reports and exceptional exact-message review (N02) through real local services, Identity accounts and storage.
// Main tests: participants report one exact message and see only their own report; review needs a reason, a different operator's approval and a
// time window; only the requester reads that one message, each read is counted and audited; conflicted operators, non-operators, recovery sessions,
// stale versions and replays are handled; review/report projections never carry message content.

using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MessageReviewTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Office)
    {
        public InboxService Inbox => F.Services.GetRequiredService<InboxService>();
        public MessageReviewService Reviews => F.Services.GetRequiredService<MessageReviewService>();
        public string Parish => Staff.Parish;
    }

    private const string Secret = "Exact private reply text";

    [Fact]
    public async Task Reported_message_is_read_only_by_the_requester_after_independent_time_limited_approval()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);
        var stranger = await f.CreateVerifiedMemberAsync();

        f.As(member, mfa: false);
        var conversation = await x.Inbox.StartAsync(x.Parish, new StartConversationDto { OperationId = Guid.NewGuid(), Subject = "Question", Body = "Hello" }, default);
        f.As(x.Office);
        var reply = await x.Inbox.PostAsync(x.Parish, conversation.Id, new PostInboxMessageDto { OperationId = Guid.NewGuid(), Body = Secret }, default);

        f.As(member, mfa: false);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(async () =>
            await x.Reviews.ReportAsync(x.Parish, conversation.Id, conversation.Id, Report(), default))).Code);
        var reportRequest = Report();
        var report = await x.Reviews.ReportAsync(x.Parish, conversation.Id, reply.Id, reportRequest, default);
        Assert.Equal(report.Id, (await x.Reviews.ReportAsync(x.Parish, conversation.Id, reply.Id, reportRequest, default)).Id);
        var own = Assert.Single(await x.Reviews.OwnReportsAsync(x.Parish, default));
        Assert.Equal(("Received", null), (own.Status, own.ReporterAccountId));
        f.As(stranger, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Reviews.ReportAsync(x.Parish, conversation.Id, reply.Id, Report(), default));
        Assert.Empty(await x.Reviews.OwnReportsAsync(x.Parish, default));
        f.AsRecovery(member);
        await Assert.ThrowsAsync<DomainException>(() => x.Reviews.OwnReportsAsync(x.Parish, default));

        // Office staff and non-operators have no review route; a recovery session is not MFA.
        foreach (var outsider in new[] { x.Office, f.Other })
        {
            f.As(outsider);
            await Assert.ThrowsAsync<DomainException>(() => x.Reviews.ReportsAsync(x.Parish, default));
            await Assert.ThrowsAsync<DomainException>(() => x.Reviews.RequestAsync(x.Parish, Review(conversation.Id, reply.Id, report.Id), default));
        }
        f.AsRecovery(f.FirstAdmin);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(async () =>
            await x.Reviews.RequestAsync(x.Parish, Review(conversation.Id, reply.Id, report.Id), default))).Code);

        f.As(f.FirstAdmin);
        var listed = Assert.Single(await x.Reviews.ReportsAsync(x.Parish, default));
        Assert.Equal((member, "Please review this message."), (listed.Value.ReporterAccountId, listed.Value.Explanation));
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(async () =>
            await x.Reviews.RequestAsync(x.Parish, Review(conversation.Id, reply.Id, report.Id, reason: "  "), default))).Code);
        await Assert.ThrowsAsync<DomainException>(() => x.Reviews.RequestAsync(x.Parish, Review(conversation.Id, Guid.NewGuid().ToString("N"), null), default));
        var requestDto = Review(conversation.Id, reply.Id, report.Id);
        var requested = await x.Reviews.RequestAsync(x.Parish, requestDto, default);
        Assert.Equal(requested.Id, (await x.Reviews.RequestAsync(x.Parish, requestDto, default)).Id);
        Assert.Equal("Requested", requested.Status);
        Assert.Equal("invalid_message_review_state", (await Assert.ThrowsAsync<DomainException>(() => x.Reviews.ReadMessageAsync(x.Parish, requested.Id, default))).Code);
        // Super Admin rank alone is not enough: the requester cannot approve their own request.
        Assert.Equal("independent_approval_required", (await Assert.ThrowsAsync<DomainException>(async () =>
            await x.Reviews.DecideAsync(x.Parish, requested.Id, await DecisionAsync(x, requested.Id, true), default))).Code);

        f.As(f.SecondAdmin);
        var stale = await DecisionAsync(x, requested.Id, true);
        stale.Version = "\"stale\"";
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Reviews.DecideAsync(x.Parish, requested.Id, stale, default))).Code);
        var noWindow = await DecisionAsync(x, requested.Id, true);
        noWindow.AccessMinutes = null;
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Reviews.DecideAsync(x.Parish, requested.Id, noWindow, default))).Code);
        var approved = await x.Reviews.DecideAsync(x.Parish, requested.Id, await DecisionAsync(x, requested.Id, true), default);
        Assert.Equal(("Approved", f.SecondAdmin), (approved.Status, approved.DecidedBy));
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Reviews.ReadMessageAsync(x.Parish, requested.Id, default))).Kind);

        f.As(f.FirstAdmin);
        var read = await x.Reviews.ReadMessageAsync(x.Parish, requested.Id, default);
        Assert.Equal((reply.Id, Secret, x.Office, "Office"), (read.MessageId, read.Body, read.AuthorAccountId, read.Capacity));
        await x.Reviews.ReadMessageAsync(x.Parish, requested.Id, default);
        var afterReads = Assert.Single(await x.Reviews.ListAsync(x.Parish, default));
        Assert.Equal(2, afterReads.Value.ReadCount);
        // Review and report projections never carry the message itself.
        Assert.DoesNotContain(Secret, JsonSerializer.Serialize(afterReads));
        Assert.DoesNotContain(Secret, JsonSerializer.Serialize(await x.Reviews.ReportsAsync(x.Parish, default)));

        f.Clock.Now = f.Clock.Now.AddMinutes(31);
        Assert.Equal("invalid_message_review_state", (await Assert.ThrowsAsync<DomainException>(() => x.Reviews.ReadMessageAsync(x.Parish, requested.Id, default))).Code);
        var expired = Assert.Single(await x.Reviews.ListAsync(x.Parish, default));
        Assert.Equal("Expired", expired.Value.Status);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Reviews.CloseAsync(x.Parish, requested.Id,
            new CloseMessageReviewDto { OperationId = Guid.NewGuid(), Version = expired.Version, Note = "Done" }, default))).Code);
        var closed = await x.Reviews.CloseAsync(x.Parish, requested.Id, new CloseMessageReviewDto
        {
            OperationId = Guid.NewGuid(), Version = expired.Version, Note = "Reviewed; office reminded of conduct rules.", ReporterOutcome = "Your report was reviewed and action was taken."
        }, default);
        Assert.Equal("Closed", closed.Status);

        // A declined request grants no read.
        var again = await x.Reviews.RequestAsync(x.Parish, Review(conversation.Id, reply.Id, null), default);
        f.As(f.SecondAdmin);
        Assert.Equal("Declined", (await x.Reviews.DecideAsync(x.Parish, again.Id, await DecisionAsync(x, again.Id, false), default)).Status);
        f.As(f.FirstAdmin);
        Assert.Equal("invalid_message_review_state", (await Assert.ThrowsAsync<DomainException>(() => x.Reviews.ReadMessageAsync(x.Parish, again.Id, default))).Code);

        f.As(member, mfa: false);
        var outcome = Assert.Single(await x.Reviews.OwnReportsAsync(x.Parish, default));
        Assert.Equal(("Closed", "Your report was reviewed and action was taken.", null), (outcome.Status, outcome.ReporterOutcome, outcome.ReporterAccountId));
    }

    [Fact]
    public async Task Conflicted_operators_cannot_see_reports_approve_or_read_and_declined_reviews_grant_nothing()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f, extraOffice: f.SecondAdmin);
        var member = await LinkedMemberAsync(x);

        f.As(member, mfa: false);
        var conversation = await x.Inbox.StartAsync(x.Parish, new StartConversationDto { OperationId = Guid.NewGuid(), Subject = "Question", Body = "Hello" }, default);
        // The second platform operator answers as parish office staff, so they are an author in this conversation.
        f.As(f.SecondAdmin);
        var reply = await x.Inbox.PostAsync(x.Parish, conversation.Id, new PostInboxMessageDto { OperationId = Guid.NewGuid(), Body = Secret }, default);
        f.As(member, mfa: false);
        var report = await x.Reviews.ReportAsync(x.Parish, conversation.Id, reply.Id, Report(), default);

        f.As(f.SecondAdmin);
        Assert.Empty(await x.Reviews.ReportsAsync(x.Parish, default));
        Assert.Equal("message_review_conflicted", (await Assert.ThrowsAsync<DomainException>(async () =>
            await x.Reviews.RequestAsync(x.Parish, Review(conversation.Id, reply.Id, report.Id), default))).Code);

        f.As(f.FirstAdmin);
        var requested = await x.Reviews.RequestAsync(x.Parish, Review(conversation.Id, reply.Id, report.Id), default);
        f.As(f.SecondAdmin);
        Assert.Equal("message_review_conflicted", (await Assert.ThrowsAsync<DomainException>(async () =>
            await x.Reviews.DecideAsync(x.Parish, requested.Id, await DecisionAsync(x, requested.Id, true), default))).Code);
        Assert.Equal("Requested", Assert.Single(await x.Reviews.ListAsync(x.Parish, default)).Value.Status);

        // In the operator's own direct conversation they are conflicted again; the request stays undecided until the requester withdraws it.
        f.As(f.SecondAdmin);
        var other = await x.Inbox.StartAsync(x.Parish, new StartConversationDto
        {
            OperationId = Guid.NewGuid(), Subject = "Direct", Body = "Direct body", RecipientAccountId = Guid.Parse(member)
        }, default);
        f.As(member, mfa: false);
        var memberReply = await x.Inbox.PostAsync(x.Parish, other.Id, new PostInboxMessageDto { OperationId = Guid.NewGuid(), Body = "Member reply" }, default);
        f.As(f.FirstAdmin);
        var second = await x.Reviews.RequestAsync(x.Parish, Review(other.Id, memberReply.Id, null), default);
        f.As(f.SecondAdmin);
        await Assert.ThrowsAsync<DomainException>(async () => await x.Reviews.DecideAsync(x.Parish, second.Id, Decision(Assert.Single((await x.Reviews.ListAsync(x.Parish, default)), r => r.Value.Id == second.Id).Version, false), default));
        Assert.Equal("Requested", (await x.Reviews.ListAsync(x.Parish, default)).Single(r => r.Value.Id == second.Id).Value.Status);
        f.As(f.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => x.Reviews.ReadMessageAsync(x.Parish, second.Id, default));
        var withdrawn = await x.Reviews.CloseAsync(x.Parish, second.Id, new CloseMessageReviewDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Reviews.ListAsync(x.Parish, default)).Single(r => r.Value.Id == second.Id).Version, Note = "Withdrawn"
        }, default);
        Assert.Equal("Closed", withdrawn.Status);
        await Assert.ThrowsAsync<DomainException>(() => x.Reviews.ReadMessageAsync(x.Parish, second.Id, default));
    }

    private static ReportMessageDto Report() => new() { OperationId = Guid.NewGuid(), Explanation = "Please review this message." };

    private static RequestMessageReviewDto Review(string conversation, string message, string? report, string reason = "Member report of unwanted contact") => new()
    {
        OperationId = Guid.NewGuid(), ConversationId = Guid.Parse(conversation), MessageId = Guid.Parse(message), ReportId = report is null ? null : Guid.Parse(report), Reason = reason
    };

    private static MessageReviewDecisionDto Decision(string version, bool approve) => new()
    {
        OperationId = Guid.NewGuid(), Version = version, Approve = approve, Reason = "Independent check of stated purpose", AccessMinutes = approve ? 30 : null
    };

    private static async Task<MessageReviewDecisionDto> DecisionAsync(Setup x, string id, bool approve)
        => Decision((await x.Reviews.ListAsync(x.Parish, default)).Single(r => r.Value.Id == id).Version, approve);

    private static async Task<Setup> CreateAsync(LocalBackendFixture f, string? extraOffice = null)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "requests"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        var office = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        foreach (var account in extraOffice is null ? [office] : new[] { office, extraOffice })
            await f.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
            {
                OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
                AccountId = Guid.Parse(account), Allows = [Permissions.CommunicationsManage], StartsAt = f.Clock.Now
            }, default);
        return new Setup(f, staff, appointment.Id, office);
    }

    private static async Task<string> LinkedMemberAsync(Setup x)
    {
        var account = await x.F.CreateVerifiedMemberAsync();
        x.F.AsAppointment(x.F.Other, x.Appointment);
        var person = await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Parishioner", BirthDate = new DateOnly(1980, 1, 1)
        }, default);
        await x.F.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(x.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(account), PersonId = Guid.Parse(person.Id), EvidenceReference = "Isolated reviewed identity"
        }, default);
        return account;
    }
}
