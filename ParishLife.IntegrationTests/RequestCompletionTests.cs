// Purpose: verifies the request completion slice through real local services, storage, cookies and CSRF: opening the record an accepted
// request needs (with the downstream authority and idempotent retries), files tied to checklist items, guest uploads with the private
// tracking token, the claimant's list of pending account links, and the signer profile version.
// Main tests: Opening_a_record_needs_acceptance_a_matched_subject_and_the_sacrament_authority_and_retries_once;
// Certificate_requests_open_a_certificate_waiting_for_its_source; Checklist_items_reference_case_files_and_uploads_name_their_item;
// Guests_upload_and_list_only_their_own_files_with_the_tracking_token; Guest_HTTP_upload_needs_CSRF_and_the_tracking_header;
// Claimants_list_pending_linked_and_declined_claims_only_for_themselves; New_routes_refuse_anonymous_callers_and_signer_profile_returns_its_version.

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Documents;
using ParishLife.Api.DTOs.Files;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Documents;
using ParishLife.Api.Services.Files;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.Requests;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class RequestCompletionTests
{
    private static readonly byte[] Pdf = "%PDF-1.4 isolated completion"u8.ToArray();

    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Clerk)
    {
        public RequestService Service => F.Services.GetRequiredService<RequestService>();
        public RequestRecordService Records => F.Services.GetRequiredService<RequestRecordService>();
        public EvidenceService Files => F.Services.GetRequiredService<EvidenceService>();
        public RequestClaimService Claims => F.Services.GetRequiredService<RequestClaimService>();
        public string Parish => Staff.Parish;
        public void Office() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task Opening_a_record_needs_acceptance_a_matched_subject_and_the_sacrament_authority_and_retries_once()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var person = await PersonAsync(x);
        x.Office();
        var phone = await PhoneAsync(x, "SacramentInquiry");
        Assert.Equal("invalid_request_state", (await Assert.ThrowsAsync<DomainException>(() => OpenAsync(x, phone, "SacramentalCase"))).Code);
        await ActAsync(x, phone, "accept");
        Assert.Equal("invalid_request_state", (await Assert.ThrowsAsync<DomainException>(() => OpenAsync(x, phone, "SacramentalCase"))).Code);
        Assert.Equal("invalid_request_state", (await Assert.ThrowsAsync<DomainException>(() => OpenAsync(x, phone, "Certificate"))).Code);
        await ActAsync(x, phone, "match-subject", r => { r.SubjectPersonId = Guid.Parse(person); r.AuthorityEvidence = "Caller confirmed date of birth"; });

        // Request access alone opens nothing: the sacramental service's own authority is still required.
        f.As(x.Clerk);
        var denied = NewOpen(await VersionAsync(x, phone), "SacramentalCase");
        await Assert.ThrowsAsync<DomainException>(() => x.Records.OpenAsync(x.Parish, phone, denied, default));
        Assert.Empty((await Current(x, phone)).Links);

        x.Office();
        var stale = NewOpen(await VersionAsync(x, phone), "SacramentalCase");
        await ActAsync(x, phone, "triage", r => r.NextAction = "Open the case");
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Records.OpenAsync(x.Parish, phone, stale, default))).Code);

        var open = NewOpen(await VersionAsync(x, phone), "SacramentalCase");
        open.Facts = new() { ["note"] = "Entered by the office" };
        var opened = await x.Records.OpenAsync(x.Parish, phone, open, default);
        Assert.Equal(("SacramentRecord", "Received", true), (opened.LinkKind, opened.RecordStatus, opened.Linked));
        var again = await x.Records.OpenAsync(x.Parish, phone, open, default);
        Assert.Equal(opened.RecordId, again.RecordId);
        var link = Assert.Single((await Current(x, phone)).Links);
        Assert.Equal(("SacramentRecord", opened.RecordId), (link.Kind, link.RecordId));
        var record = (await f.Services.GetRequiredService<IRecordTransactions>().ReadAsync<SacramentRecord>(Scope(x), "sacrament:" + opened.RecordId, default))!.Value;
        Assert.Equal((phone, person, "Baptism"), (record.RequestId, record.PersonId, record.Kind));
        Assert.Single(await f.Services.GetRequiredService<IRecordTransactions>().CollectAsync<SacramentRecord>(Scope(x), "sacramentRecord", default));
        Assert.Contains(await x.Service.HistoryAsync(x.Parish, phone, default), h => h.Action == "link");
    }

    [Fact]
    public async Task Certificate_requests_open_a_certificate_waiting_for_its_source()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var person = await PersonAsync(x);
        x.Office();
        var phone = await PhoneAsync(x, "Certificate");
        await ActAsync(x, phone, "match-subject", r => { r.SubjectPersonId = Guid.Parse(person); r.AuthorityEvidence = "Seen in person"; });
        await ActAsync(x, phone, "accept");
        Assert.Equal("invalid_request_state", (await Assert.ThrowsAsync<DomainException>(() => OpenAsync(x, phone, "SacramentalCase"))).Code);
        var open = NewOpen(await VersionAsync(x, phone), "Certificate");
        open.Language = "ar";
        var opened = await x.Records.OpenAsync(x.Parish, phone, open, default);
        Assert.Equal(("Certificate", "WaitingForSource"), (opened.LinkKind, opened.RecordStatus));
        Assert.Equal(opened.RecordId, (await x.Records.OpenAsync(x.Parish, phone, open, default)).RecordId);
        Assert.Equal(opened.RecordId, Assert.Single((await Current(x, phone)).Links).RecordId);
    }

    [Fact]
    public async Task Checklist_items_reference_case_files_and_uploads_name_their_item()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var applicant = await f.CreateVerifiedMemberAsync();
        f.As(applicant, mfa: false);
        var created = await x.Service.SubmitAsync(x.Parish, Submit("Certificate"), default);
        f.As(x.Clerk);
        await SetChecklistAsync(x, created.Id, new ChecklistItemDto { Key = "birth-certificate", Label = "Birth certificate", Required = true, Status = "Missing" });

        f.As(applicant, mfa: false);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() =>
            x.Files.UploadAsync(x.Parish, created.Id, Guid.NewGuid(), "proof.pdf", "application/pdf", Pdf, null, null, default, "unknown-item"))).Code);
        var operation = Guid.NewGuid();
        var upload = await x.Files.UploadAsync(x.Parish, created.Id, operation, "proof.pdf", "application/pdf", Pdf, null, null, default, "birth-certificate");
        Assert.Equal("birth-certificate", upload.ChecklistKey);
        // The retry with the same key replays; the same operation without the key is a different input.
        Assert.Equal(upload.Id, (await x.Files.UploadAsync(x.Parish, created.Id, operation, "proof.pdf", "application/pdf", Pdf, null, null, default, "birth-certificate")).Id);
        await Assert.ThrowsAsync<DomainException>(() => x.Files.UploadAsync(x.Parish, created.Id, operation, "proof.pdf", "application/pdf", Pdf, null, null, default));
        var replacement = await x.Files.UploadAsync(x.Parish, created.Id, Guid.NewGuid(), "clearer.pdf", "application/pdf", "%PDF-1.7 clearer"u8.ToArray(), upload.Id, "Clearer scan", default);
        Assert.Equal("birth-certificate", replacement.ChecklistKey);

        f.As(x.Clerk);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => SetChecklistAsync(x, created.Id,
            new ChecklistItemDto { Key = "birth-certificate", Label = "Birth certificate", Required = true, Status = "Received", EvidenceFileId = upload.Id }))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => SetChecklistAsync(x, created.Id,
            new ChecklistItemDto { Key = "birth-certificate", Label = "Birth certificate", Required = true, Status = "Missing", EvidenceFileId = replacement.Id }))).Code);
        var other = await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        f.As(x.Clerk);
        var foreign = await x.Files.UploadAsync(x.Parish, other.RequestId, Guid.NewGuid(), "other.pdf", "application/pdf", Pdf, null, null, default);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => SetChecklistAsync(x, created.Id,
            new ChecklistItemDto { Key = "birth-certificate", Label = "Birth certificate", Required = true, Status = "Received", EvidenceFileId = foreign.Id }))).Code);
        var saved = await SetChecklistAsync(x, created.Id,
            new ChecklistItemDto { Key = "birth-certificate", Label = "Birth certificate", Required = true, Status = "Received", EvidenceFileId = replacement.Id });
        Assert.Equal((replacement.Id, x.Clerk), (saved.Checklist[0].EvidenceFileId, saved.Checklist[0].VerifiedBy));

        f.As(applicant, mfa: false);
        var mine = (await x.Service.GetAsync(x.Parish, created.Id, default)).Value.Checklist.Single();
        Assert.Equal(("Received", (string?)null), (mine.Status, mine.EvidenceFileId));
    }

    [Fact]
    public async Task Guests_upload_and_list_only_their_own_files_with_the_tracking_token()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var receipt = await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        await Assert.ThrowsAsync<DomainException>(() =>
            x.Files.GuestUploadAsync(x.Parish, receipt.RequestId, "wrong-token", Guid.NewGuid(), "id.pdf", "application/pdf", Pdf, null, null, null, default));
        var operation = Guid.NewGuid();
        var mine = await x.Files.GuestUploadAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, operation, "هوية.pdf", "application/pdf", Pdf, null, null, null, default);
        Assert.Equal(("Guest", "هوية.pdf"), (mine.UploaderRole, mine.FileName));
        Assert.Equal(mine.Id, (await x.Files.GuestUploadAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, operation, "هوية.pdf", "application/pdf", Pdf, null, null, null, default)).Id);
        Assert.Equal("operation_reused", (await Assert.ThrowsAsync<DomainException>(() =>
            x.Files.GuestUploadAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, operation, "هوية.pdf", "application/pdf", "%PDF-1.4 changed bytes!!!!!!"u8.ToArray(), null, null, null, default))).Code);

        f.As(x.Clerk);
        var office = await x.Files.UploadAsync(x.Parish, receipt.RequestId, Guid.NewGuid(), "office.pdf", "application/pdf", Pdf, null, null, default);
        var all = await x.Files.ListAsync(x.Parish, receipt.RequestId, default);
        Assert.Equal(2, all.Count);
        Assert.Equal(Pdf, (await x.Files.DownloadAsync(x.Parish, receipt.RequestId, mine.Id, default)).Content);
        Assert.Equal(mine.Id, Assert.Single(await x.Files.GuestListAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default)).Id);
        await Assert.ThrowsAsync<DomainException>(() => x.Files.GuestUploadAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, Guid.NewGuid(),
            "swap.pdf", "application/pdf", Pdf, office.Id, "Not mine", null, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Files.GuestListAsync(x.Parish, receipt.RequestId, "wrong-token", default));

        // Once the case joins an account, the bearer link no longer uploads.
        var account = await f.CreateVerifiedMemberAsync();
        f.As(account, mfa: false);
        await x.Service.ClaimGuestAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default);
        f.As(x.Clerk);
        await x.Service.DecideAssociationAsync(x.Parish, receipt.RequestId, new RequestAssociationDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, receipt.RequestId), Approve = true, EvidenceReference = "Office identity check"
        }, default);
        await Assert.ThrowsAsync<DomainException>(() => x.Files.GuestUploadAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, Guid.NewGuid(),
            "late.pdf", "application/pdf", Pdf, null, null, null, default));
    }

    [Fact]
    public async Task Guest_HTTP_upload_needs_CSRF_and_the_tracking_header()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var receipt = await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var guest = factory.Client();
        var path = $"/api/public/parishes/{x.Parish}/requests/{receipt.RequestId}/files";
        using (var body = Multipart()) Assert.False((await guest.PostAsync(path, body)).IsSuccessStatusCode);
        await MinistryHttpTests.CsrfAsync(guest);
        using (var body = Multipart()) Assert.Equal(HttpStatusCode.NotFound, (await guest.PostAsync(path, body)).StatusCode);
        guest.DefaultRequestHeaders.Add("X-ParishLife-Tracking", receipt.TrackingToken);
        using (var body = Multipart())
            Assert.Equal("Guest", (await MinistryHttpTests.ReadAsync<EvidenceFileDto>(await guest.PostAsync(path, body))).UploaderRole);
        var listed = await MinistryHttpTests.ReadAsync<List<EvidenceFileDto>>(await guest.GetAsync(path));
        Assert.Single(listed);
        Assert.Equal(HttpStatusCode.NotFound, (await guest.GetAsync(path + "/" + listed[0].Id)).StatusCode);
    }

    [Fact]
    public async Task Claimants_list_pending_linked_and_declined_claims_only_for_themselves()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var first = await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        var second = await x.Service.GuestSubmitAsync(x.Parish, Guest(), default);
        var account = await f.CreateVerifiedMemberAsync();
        f.As(account, mfa: false);
        Assert.Empty(await x.Claims.ListAsync(default));
        await x.Service.ClaimGuestAsync(x.Parish, first.RequestId, first.TrackingToken, default);
        await x.Service.ClaimGuestAsync(x.Parish, second.RequestId, second.TrackingToken, default);
        var pending = await x.Claims.ListAsync(default);
        Assert.Equal(2, pending.Count);
        Assert.All(pending, c => Assert.Equal(("Pending", x.Parish), (c.State, c.ParishId)));
        Assert.Contains(pending, c => c.Reference == first.Reference);
        var stranger = await f.CreateVerifiedMemberAsync();
        f.As(stranger, mfa: false);
        Assert.Empty(await x.Claims.ListAsync(default));

        f.As(x.Clerk);
        await x.Service.DecideAssociationAsync(x.Parish, first.RequestId, new RequestAssociationDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, first.RequestId), Approve = true, EvidenceReference = "Office identity check"
        }, default);
        await x.Service.DecideAssociationAsync(x.Parish, second.RequestId, new RequestAssociationDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, second.RequestId), Approve = false, Reason = "Identity not confirmed"
        }, default);
        f.As(account, mfa: false);
        var decided = await x.Claims.ListAsync(default);
        Assert.Equal("Linked", decided.Single(c => c.RequestId == first.RequestId).State);
        Assert.Equal("NotPending", decided.Single(c => c.RequestId == second.RequestId).State);
        // Claiming again after a decline keeps one pointer for the case.
        await x.Service.ClaimGuestAsync(x.Parish, second.RequestId, second.TrackingToken, default);
        Assert.Equal("Pending", Assert.Single(await x.Claims.ListAsync(default), c => c.RequestId == second.RequestId).State);
    }

    [Fact]
    public async Task New_routes_refuse_anonymous_callers_and_signer_profile_returns_its_version()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var anonymous = factory.Client();
        await MinistryHttpTests.CsrfAsync(anonymous);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/me/request-claims")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsJsonAsync($"/api/parishes/{x.Parish}/requests/{Guid.NewGuid()}/records",
            NewOpen("v", "SacramentalCase"))).StatusCode);

        var member = await f.CreateVerifiedMemberAsync();
        var name = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(member))!.UserName!;
        using var client = factory.Client();
        await MinistryHttpTests.LoginAsync(client, name);
        Assert.Empty(await MinistryHttpTests.ReadAsync<List<RequestClaimDto>>(await client.GetAsync("/api/me/request-claims")));

        f.As(f.Other);
        var signatures = f.Services.GetRequiredService<DocumentSignatureService>();
        var saved = await signatures.SaveProfileAsync(new SaveSignerProfileDto { OperationId = Guid.NewGuid(), PrintedName = "Isolated Signer" }, default);
        var read = await signatures.ProfileAsync(default);
        Assert.Equal((saved.Version, "Isolated Signer"), (read.Version, read.PrintedName));
        await signatures.SaveProfileAsync(new SaveSignerProfileDto { OperationId = Guid.NewGuid(), Version = read.Version, PrintedName = "Isolated Signer II" }, default);
        Assert.Equal("Isolated Signer II", (await signatures.ProfileAsync(default)).PrintedName);
    }

    private static MultipartFormDataContent Multipart()
    {
        var body = new MultipartFormDataContent();
        body.Add(new StringContent(Guid.NewGuid().ToString()), "operationId");
        var bytes = new ByteArrayContent(Pdf);
        bytes.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        body.Add(bytes, "file", "proof.pdf");
        return body;
    }

    private static OpenRequestRecordDto NewOpen(string version, string kind) => new()
    {
        OperationId = Guid.NewGuid(), Version = version, RecordKind = kind, Sacrament = "Baptism"
    };

    private static async Task<OpenedRequestRecordDto> OpenAsync(Setup x, string id, string kind)
        => await x.Records.OpenAsync(x.Parish, id, NewOpen(await VersionAsync(x, id), kind), default);

    private static async Task<string> PhoneAsync(Setup x, string kind)
    {
        var phone = Submit(kind);
        phone.Origin = "Telephone";
        phone.RequesterName = "Isolated caller";
        phone.RequesterContact = "+961 1 000 000";
        return (await x.Service.SubmitAsync(x.Parish, phone, default)).Id;
    }

    private static async Task<ParishRequestDto> SetChecklistAsync(Setup x, string id, params ChecklistItemDto[] items)
        => await x.Service.SetChecklistAsync(x.Parish, id, new SetChecklistDto { OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Items = items }, default);

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "requests", "sacraments"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other,
            allows: [Permissions.RequestsManage, Permissions.SacramentsRecord, Permissions.PeopleRead, Permissions.PeopleWrite]));
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
        x.Office();
        return (await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Subject", BirthDate = new DateOnly(2000, 1, 1)
        }, default)).Id;
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

    private static async Task<ParishRequestDto> ActAsync(Setup x, string id, string action, Action<RequestActionDto>? configure = null)
    {
        var request = new RequestActionDto { OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Action = action };
        configure?.Invoke(request);
        return await x.Service.ActAsync(x.Parish, id, request, default);
    }

    private static async Task<ParishRequest> Current(Setup x, string id)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<ParishRequest>(Scope(x), "request:" + id, default))!.Value;

    private static RecordScope Scope(Setup x) => new() { Area = RecordArea.Parish, OwnerId = x.Parish };

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync(Setup x, string id)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<ParishRequest>(Scope(x), "request:" + id, default))!.Version;
}
