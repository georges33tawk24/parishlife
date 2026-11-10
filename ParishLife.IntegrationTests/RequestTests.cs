// Purpose: verifies request cases (S11–S12 intake) through real local services, storage, cookies and CSRF.
// Main tests: member lifecycle with distinct received/accepted/priest-approved/date-confirmed facts, needs-information and edits;
// representation review; office telephone entry and subject matching; internal versus applicant messages; guest token tracking; HTTP.

using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Files;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Files;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Reporting;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.Requests;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class RequestTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Clerk)
    {
        public RequestService Service => F.Services.GetRequiredService<RequestService>();
        public string Parish => Staff.Parish;
        public void Priest() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task Member_case_keeps_received_accepted_approved_and_dated_as_separate_facts()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);
        f.As(member.Account, mfa: false);
        var created = await x.Service.SubmitAsync(x.Parish, Submit("SacramentInquiry"), default);
        Assert.Equal("Received", created.Status);
        Assert.StartsWith("Received: saved for review", created.StatusMeaning);
        Assert.StartsWith("R-", created.Reference);
        var edited = await ActAsync(x, created.Id, "edit", r => r.Summary = "Baptism for our son (corrected)");
        Assert.Equal("Baptism for our son (corrected)", edited.Summary);

        f.As(x.Clerk);
        var triaged = await ActAsync(x, created.Id, "triage", r => { r.AssignedTo = Guid.Parse(x.Clerk); r.Urgency = "Urgent"; r.UrgencyReason = "Family travelling"; r.NextAction = "Call family"; });
        Assert.Equal(x.Clerk, triaged.AssignedTo);
        Assert.Equal(member.Person, (await x.Service.GetAsync(x.Parish, created.Id, default)).Value.SubjectPersonId);
        await ActAsync(x, created.Id, "return", r => r.Explanation = "Please add the godparents' names.");

        f.As(member.Account, mfa: false);
        var mine = (await x.Service.GetAsync(x.Parish, created.Id, default)).Value;
        Assert.Equal(("NeedsInformation", "Please add the godparents' names."), (mine.Status, mine.ApplicantExplanation));
        Assert.Null(mine.AssignedTo);
        Assert.Null(mine.NextAction);
        await ActAsync(x, created.Id, "respond", r => { r.Explanation = "Godparents: A and B"; r.Details = new() { ["godparents"] = "A and B" }; });

        f.As(x.Clerk);
        await ActAsync(x, created.Id, "accept");
        Assert.Equal("invalid_request_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, created.Id, "confirm-date", r => r.ConfirmedDate = f.Clock.Now.AddDays(30)))).Code);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, created.Id, "clergy-approve"));
        await x.Service.SetChecklistAsync(x.Parish, created.Id, new SetChecklistDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, created.Id),
            Items = [new ChecklistItemDto { Key = "birth-certificate", Label = "Birth certificate", Required = true, Status = "Missing" }]
        }, default);
        x.Priest();
        var approved = await ActAsync(x, created.Id, "clergy-approve");
        Assert.Contains("approved by priest", approved.StatusMeaning);
        Assert.Contains("no date is confirmed", approved.StatusMeaning);
        f.As(x.Clerk);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, created.Id, "confirm-date", r => r.ConfirmedDate = f.Clock.Now.AddDays(30)));
        await x.Service.SetChecklistAsync(x.Parish, created.Id, new SetChecklistDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, created.Id),
            Items = [new ChecklistItemDto { Key = "birth-certificate", Label = "Birth certificate", Required = true, Status = "Received", PaperReference = "Office binder 4, page 12" }]
        }, default);
        Assert.Contains("date confirmed", (await ActAsync(x, created.Id, "confirm-date", r => r.ConfirmedDate = f.Clock.Now.AddDays(30))).StatusMeaning);

        f.As(member.Account, mfa: false);
        Assert.Equal("invalid_request_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, created.Id, "edit", r => r.Summary = "Late change"))).Code);
        Assert.Equal("CancellationRequested", (await ActAsync(x, created.Id, "request-cancel", r => r.Explanation = "We moved abroad")).Status);
        f.As(x.Clerk);
        Assert.Equal("Cancelled", (await ActAsync(x, created.Id, "cancel", r => r.Explanation = "Cancelled at the family's request")).Status);
        var history = await x.Service.HistoryAsync(x.Parish, created.Id, default);
        Assert.Contains(history, h => h.Action == "edit" && h.Previous!.Summary == "Isolated request");
        Assert.Equal(12, history.Count);
    }

    [Fact]
    public async Task Requests_for_others_need_an_authority_basis_reviewed_before_acceptance()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var applicant = await f.CreateVerifiedMemberAsync();
        f.As(applicant, mfa: false);
        var forParent = Submit("Visit");
        forParent.Relationship = "Child";
        forParent.SubjectDescription = "My elderly mother at home";
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Service.SubmitAsync(x.Parish, forParent, default))).Code);
        forParent.AuthorityBasis = "I am her registered carer";
        forParent.SubjectPersonId = Guid.NewGuid();
        await Assert.ThrowsAsync<DomainException>(() => x.Service.SubmitAsync(x.Parish, forParent, default));
        forParent.SubjectPersonId = null;
        forParent.OperationId = Guid.NewGuid();
        var created = await x.Service.SubmitAsync(x.Parish, forParent, default);
        Assert.Null(created.SubjectPersonId);

        f.As(x.Clerk);
        Assert.Equal("invalid_request_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, created.Id, "accept"))).Code);
        await ActAsync(x, created.Id, "review-authority", r => r.AuthorityEvidence = "Carer letter seen in person");
        Assert.Equal("AcceptedForProcessing", (await ActAsync(x, created.Id, "accept")).Status);
    }

    [Fact]
    public async Task Office_telephone_entry_records_origin_and_matches_the_subject_later()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var person = await PersonAsync(x);
        f.As(x.Clerk);
        var phone = Submit("MassIntention");
        phone.Origin = "Telephone";
        await Assert.ThrowsAsync<DomainException>(() => x.Service.SubmitAsync(x.Parish, phone, default));
        phone.OperationId = Guid.NewGuid();
        phone.RequesterName = "Isolated caller";
        phone.RequesterContact = "+961 1 000 000";
        var created = await x.Service.SubmitAsync(x.Parish, phone, default);
        Assert.Equal(("Telephone", (string?)null, x.Clerk), (created.Origin, created.ApplicantAccountId, created.CreatedBy));
        var matched = await ActAsync(x, created.Id, "match-subject", r => { r.SubjectPersonId = Guid.Parse(person); r.AuthorityEvidence = "Caller confirmed date of birth"; });
        Assert.Equal(person, matched.SubjectPersonId);
        await ActAsync(x, created.Id, "link", r => { r.LinkKind = "Event"; r.LinkRecordId = Guid.NewGuid(); });
        Assert.Single((await x.Service.GetAsync(x.Parish, created.Id, default)).Value.Links);
    }

    [Fact]
    public async Task Applicants_never_see_internal_notes_and_guests_track_only_with_their_private_token()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var applicant = await f.CreateVerifiedMemberAsync();
        f.As(applicant, mfa: false);
        var created = await x.Service.SubmitAsync(x.Parish, Submit("General"), default);
        await x.Service.PostMessageAsync(x.Parish, created.Id, Message("Applicant", "Is Sunday possible?"), default);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.PostMessageAsync(x.Parish, created.Id, Message("Internal", "Sneaky"), default));
        // Messages are ordered by their real time; the frozen test clock is advanced so each has its own.
        f.Clock.Now = f.Clock.Now.AddMinutes(1);
        f.As(x.Clerk);
        await x.Service.PostMessageAsync(x.Parish, created.Id, Message("Internal", "Family known to the priest"), default);
        f.Clock.Now = f.Clock.Now.AddMinutes(1);
        await x.Service.PostMessageAsync(x.Parish, created.Id, Message("Applicant", "Sunday works"), default);
        Assert.Equal(3, (await x.Service.MessagesAsync(x.Parish, created.Id, null, default)).Count);
        f.As(applicant, mfa: false);
        var visible = await x.Service.MessagesAsync(x.Parish, created.Id, null, default);
        Assert.Equal(["Is Sunday possible?", "Sunday works"], visible.Select(m => m.Body));
        var stranger = await f.CreateVerifiedMemberAsync();
        f.As(stranger, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.GetAsync(x.Parish, created.Id, default));

        var receipt = await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.GuestGetAsync(x.Parish, receipt.RequestId, "wrong-token", default));
        Assert.Equal("Guest", (await x.Service.GuestGetAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default)).Origin);
        f.As(x.Clerk);
        await ActAsync(x, receipt.RequestId, "return", r => r.Explanation = "Which date suits you?");
        await Assert.ThrowsAsync<DomainException>(() => x.Service.GuestActAsync(x.Parish, receipt.RequestId, receipt.TrackingToken,
            new RequestActionDto { OperationId = Guid.NewGuid(), Version = "any", Action = "accept" }, default));
        var resumed = await x.Service.GuestActAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, new RequestActionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, receipt.RequestId), Action = "respond", Explanation = "Any Saturday"
        }, default);
        Assert.Equal("Received", resumed.Status);
        Assert.Contains((await x.Service.MessagesAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default)), m => m.Body == "Any Saturday" && m.AuthorKind == "Guest");
    }

    [Fact]
    public async Task Guest_HTTP_intake_needs_CSRF_and_the_tracking_header()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var guest = factory.Client();
        var path = $"/api/public/parishes/{x.Parish}/requests";
        Assert.False((await guest.PostAsJsonAsync(path, Guest())).IsSuccessStatusCode);
        await MinistryHttpTests.CsrfAsync(guest);
        var receipt = await MinistryHttpTests.ReadAsync<GuestRequestReceiptDto>(await guest.PostAsJsonAsync(path, Guest()));
        Assert.Equal(HttpStatusCode.NotFound, (await guest.GetAsync($"{path}/{receipt.RequestId}")).StatusCode);
        using var tracked = new HttpRequestMessage(HttpMethod.Get, $"{path}/{receipt.RequestId}");
        tracked.Headers.Add("X-ParishLife-Tracking", receipt.TrackingToken);
        var json = await (await guest.SendAsync(tracked)).Content.ReadAsStringAsync();
        Assert.Contains(receipt.Reference, json);
        Assert.DoesNotContain("guestTokenHash", json, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.Client().GetAsync($"/api/parishes/{x.Parish}/requests")).StatusCode);
    }

    [Fact]
    public async Task Guest_cases_join_an_account_only_after_office_identity_review_and_leaked_links_rotate()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var receipt = await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        var account = await f.CreateVerifiedMemberAsync();
        f.As(account, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.ClaimGuestAsync(x.Parish, receipt.RequestId, "wrong-token", default));
        await x.Service.ClaimGuestAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.GetAsync(x.Parish, receipt.RequestId, default));
        var other = await f.CreateVerifiedMemberAsync();
        f.As(other, mfa: false);
        Assert.Equal("invalid_request_state", (await Assert.ThrowsAsync<DomainException>(() => x.Service.ClaimGuestAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default))).Code);

        f.As(x.Clerk);
        Assert.Equal(account, (await x.Service.GetAsync(x.Parish, receipt.RequestId, default)).Value.ClaimantAccountId);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => AssociateAsync(x, receipt.RequestId, true, null))).Code);
        var joined = await AssociateAsync(x, receipt.RequestId, true, "Office identity check");
        Assert.Equal((account, (string?)null), (joined.ApplicantAccountId, joined.ClaimantAccountId));
        await Assert.ThrowsAsync<DomainException>(() => x.Service.GuestGetAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default));
        f.As(account, mfa: false);
        Assert.Equal("Guest", (await x.Service.GetAsync(x.Parish, receipt.RequestId, default)).Value.Origin);

        var leaked = await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        f.As(other, mfa: false);
        await x.Service.ClaimGuestAsync(x.Parish, leaked.RequestId, leaked.TrackingToken, default);
        f.As(x.Clerk);
        var rotated = await x.Service.RotateTrackingAsync(x.Parish, leaked.RequestId, new RotateTrackingDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, leaked.RequestId), Reason = "Guest reported the link was forwarded."
        }, default);
        await Assert.ThrowsAsync<DomainException>(() => x.Service.GuestGetAsync(x.Parish, leaked.RequestId, leaked.TrackingToken, default));
        Assert.Null((await x.Service.GuestGetAsync(x.Parish, leaked.RequestId, rotated.TrackingToken, default)).ClaimantAccountId);
        Assert.Contains(await x.Service.MessagesAsync(x.Parish, leaked.RequestId, null, default), m => m.Audience == "Internal" && m.Body.StartsWith("Tracking link replaced", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Office_coverage_lists_any_number_of_holders_and_hands_open_cases_over()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var first = await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        var second = await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        f.As(x.Clerk);
        foreach (var id in new[] { first.RequestId, second.RequestId })
            await ActAsync(x, id, "triage", r => r.AssignedTo = Guid.Parse(x.Clerk));
        var successor = await f.CreateVerifiedStaffAsync();
        var outsider = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(x.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await x.Staff.Parishes.GetAsync(x.Parish, default))!.Version,
            AccountId = Guid.Parse(successor), Allows = [Permissions.RequestsManage], StartsAt = f.Clock.Now
        }, default);
        var coverage = f.Services.GetRequiredService<OfficeCoverageService>();
        var before = await coverage.CoverageAsync(x.Parish, default);
        Assert.False(before.NoOfficeHolder);
        Assert.Equal((2, 0), (before.Holders.Single(h => h.AccountId == x.Clerk).OpenRequests, before.Holders.Single(h => h.AccountId == successor).OpenRequests));
        Assert.Equal("invalid_request_state", (await Assert.ThrowsAsync<DomainException>(() => x.Service.HandoverAsync(x.Parish, new OfficeHandoverDto
        {
            OperationId = Guid.NewGuid(), FromAccountId = Guid.Parse(x.Clerk), ToAccountId = Guid.Parse(outsider)
        }, default))).Code);
        var moved = await x.Service.HandoverAsync(x.Parish, new OfficeHandoverDto
        {
            OperationId = Guid.NewGuid(), FromAccountId = Guid.Parse(x.Clerk), ToAccountId = Guid.Parse(successor)
        }, default);
        Assert.Equal((2, 0), (moved.Moved, moved.Remaining));
        var after = await coverage.CoverageAsync(x.Parish, default);
        Assert.Equal((0, 2), (after.Holders.Single(h => h.AccountId == x.Clerk).OpenRequests, after.Holders.Single(h => h.AccountId == successor).OpenRequests));
        f.As(successor);
        Assert.Contains(await x.Service.HistoryAsync(x.Parish, first.RequestId, default), h => h.Action == "handover");
    }

    [Fact]
    public async Task Case_files_are_checked_by_content_versioned_on_replacement_and_visible_by_audience()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var member = await LinkedMemberAsync(x);
        f.As(member.Account, mfa: false);
        var created = await x.Service.SubmitAsync(x.Parish, Submit("Certificate"), default);
        var files = f.Services.GetRequiredService<EvidenceService>();
        var pdf = "%PDF-1.4 isolated"u8.ToArray();
        Assert.Equal("invalid_file", (await Assert.ThrowsAsync<DomainException>(() =>
            files.UploadAsync(x.Parish, created.Id, Guid.NewGuid(), "notes.pdf", "application/pdf", "plain text"u8.ToArray(), null, null, default))).Code);
        Assert.Equal("invalid_file", (await Assert.ThrowsAsync<DomainException>(() =>
            files.UploadAsync(x.Parish, created.Id, Guid.NewGuid(), "photo.png", "image/png", pdf, null, null, default))).Code);
        var operation = Guid.NewGuid();
        var mine = await files.UploadAsync(x.Parish, created.Id, operation, "شهادة معمودية.pdf", "application/pdf", pdf, null, null, default);
        Assert.Equal(("شهادة معمودية.pdf", "Applicant", mine.Id), (mine.FileName, mine.UploaderRole,
            (await files.UploadAsync(x.Parish, created.Id, operation, "شهادة معمودية.pdf", "application/pdf", pdf, null, null, default)).Id));

        f.As(x.Clerk);
        var png = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3 };
        var office = await files.UploadAsync(x.Parish, created.Id, Guid.NewGuid(), "scan.png", "image/png", png, null, null, default);
        Assert.Equal(2, (await files.ListAsync(x.Parish, created.Id, default)).Count);
        f.As(member.Account, mfa: false);
        Assert.Equal(mine.Id, Assert.Single(await files.ListAsync(x.Parish, created.Id, default)).Id);
        Assert.Equal(pdf, (await files.DownloadAsync(x.Parish, created.Id, mine.Id, default)).Content);
        await Assert.ThrowsAsync<DomainException>(() => files.DownloadAsync(x.Parish, created.Id, office.Id, default));
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() =>
            files.UploadAsync(x.Parish, created.Id, Guid.NewGuid(), "better.pdf", "application/pdf", "%PDF-1.7 clearer"u8.ToArray(), mine.Id, null, default))).Code);
        var replacement = await files.UploadAsync(x.Parish, created.Id, Guid.NewGuid(), "better.pdf", "application/pdf", "%PDF-1.7 clearer"u8.ToArray(), mine.Id, "Clearer scan", default);
        var listed = await files.ListAsync(x.Parish, created.Id, default);
        Assert.Equal(("Replaced", replacement.Id), (listed.Single(l => l.Id == mine.Id).Status, listed.Single(l => l.Id == mine.Id).ReplacedById));

        f.As(x.Clerk);
        var current = (await files.ListAsync(x.Parish, created.Id, default)).Single(l => l.Id == replacement.Id);
        Assert.Equal("Removed", (await files.RemoveAsync(x.Parish, created.Id, replacement.Id, new RemoveEvidenceDto { OperationId = Guid.NewGuid(), Version = current.Version, Reason = "Belongs to another case" }, default)).Status);
        f.As(member.Account, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => files.DownloadAsync(x.Parish, created.Id, replacement.Id, default));
        var stranger = await f.CreateVerifiedMemberAsync();
        f.As(stranger, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => files.ListAsync(x.Parish, created.Id, default));
    }

    [Fact]
    public async Task Work_overview_counts_only_open_cases_in_queues_the_viewer_may_see()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var first = await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        var overview = f.Services.GetRequiredService<WorkOverviewService>();
        f.As(x.Clerk);
        await ActAsync(x, first.RequestId, "decline", r => r.Explanation = "Outside this parish");
        var clerk = await overview.OverviewAsync(x.Parish, default);
        Assert.Equal(("Open requests", 1), (Assert.Single(clerk.Counts).Queue, clerk.Counts[0].Count));

        f.As(f.FirstAdmin);
        var owner = await overview.OverviewAsync(x.Parish, default);
        Assert.Contains(owner.Counts, c => c.Queue == "Unmatched bank lines" && c.Count == 0);
        Assert.DoesNotContain(owner.Counts, c => c.Area == "Care");
        f.As(await f.CreateVerifiedStaffAsync());
        await Assert.ThrowsAsync<DomainException>(() => overview.OverviewAsync(x.Parish, default));
    }

    private static async Task<ParishRequestDto> AssociateAsync(Setup x, string id, bool approve, string? evidence)
        => await x.Service.DecideAssociationAsync(x.Parish, id, new RequestAssociationDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Approve = approve, EvidenceReference = evidence, Reason = approve ? null : "Identity not confirmed"
        }, default);

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "requests"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.RequestsManage, Permissions.PeopleRead, Permissions.PeopleWrite]));
        var clerk = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(clerk), Allows = [Permissions.RequestsManage], StartsAt = f.Clock.Now
        }, default);
        return new Setup(f, staff, appointment.Id, clerk);
    }

    private static async Task<string> PersonAsync(Setup x)
    {
        x.Priest();
        return (await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Subject", BirthDate = new DateOnly(2000, 1, 1)
        }, default)).Id;
    }

    private static async Task<(string Account, string Person)> LinkedMemberAsync(Setup x)
    {
        var account = await x.F.CreateVerifiedMemberAsync();
        var person = await PersonAsync(x);
        x.Priest();
        await x.F.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(x.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(account), PersonId = Guid.Parse(person), EvidenceReference = "Isolated reviewed identity"
        }, default);
        return (account, person);
    }

    private static SubmitRequestDto Submit(string kind) => new()
    {
        OperationId = Guid.NewGuid(), Kind = kind, Summary = "Isolated request", Details = new() { ["note"] = "Isolated details" }, PreferredDates = "Any Sunday"
    };

    private static GuestRequestDto Guest() => new()
    {
        OperationId = Guid.NewGuid(), Kind = "Blessing", Summary = "House blessing", Details = new() { ["address"] = "Isolated street" },
        RequesterName = "Isolated guest", RequesterContact = "guest@fixture.example", SubjectDescription = "Our new home"
    };

    private static PostRequestMessageDto Message(string audience, string body) => new() { OperationId = Guid.NewGuid(), Audience = audience, Body = body };

    private static async Task<ParishRequestDto> ActAsync(Setup x, string id, string action, Action<RequestActionDto>? configure = null)
    {
        var request = new RequestActionDto { OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Action = action };
        configure?.Invoke(request);
        return await x.Service.ActAsync(x.Parish, id, request, default);
    }

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync(Setup x, string id)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<ParishRequest>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, "request:" + id, default))!.Version;
}
