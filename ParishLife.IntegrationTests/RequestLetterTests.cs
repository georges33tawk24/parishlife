// Purpose: verifies office letters for request cases (X04) through real local services, Identity accounts, Data Protection and storage.
// Main tests: a guest request's letter is drafted by the office, signed exactly by a current parish priest with a fresh authenticator code,
// released only after the server matches the re-entered request/addressee/content, never exposed to the tracking token, and withdrawn with
// history; an account applicant receives the text; replacements supersede; revoked authorizations block release; stale/replayed writes; HTTP.

using System.Net;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Documents;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Documents;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Requests;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class RequestLetterTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Clerk, string Releaser)
    {
        public void Signer() => F.AsAppointment(F.Other, Appointment);
        public RequestLetterService Letters => F.Services.GetRequiredService<RequestLetterService>();
        public RequestService Requests => F.Services.GetRequiredService<RequestService>();
        public DocumentSignatureService Signatures => F.Services.GetRequiredService<DocumentSignatureService>();
        public string Parish => Staff.Parish;
    }

    [Fact]
    public async Task Guest_letters_are_signed_exactly_released_after_matching_checks_and_never_served_to_the_tracking_link()
    {
        await using var f = await StartAsync();
        var x = await CreateAsync(f, profile: false);
        var receipt = await x.Requests.GuestSubmitAsync(x.Parish, Guest(), default);

        f.As(x.Clerk);
        var create = Draft();
        var letter = await x.Letters.CreateAsync(x.Parish, receipt.RequestId, create, default);
        Assert.Equal(("Draft", 1), (letter.Status, letter.Version));
        Assert.Equal(letter.Id, (await x.Letters.CreateAsync(x.Parish, receipt.RequestId, create, default)).Id);
        Assert.Single(await x.Letters.ListAsync(x.Parish, receipt.RequestId, default));
        // The office drafts but holds no signing authority.
        await Assert.ThrowsAsync<DomainException>(() => SignAsync(x, letter.Id));

        x.Signer();
        Assert.Equal("signer_profile_required", (await Assert.ThrowsAsync<DomainException>(() => SignAsync(x, letter.Id))).Code);
        f.As(f.Other);
        await x.Signatures.SaveProfileAsync(new SaveSignerProfileDto { OperationId = Guid.NewGuid(), PrintedName = "Fr. Isolated Priest" }, default);
        x.Signer();
        Assert.Empty(await x.Letters.GuestAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default));
        var signed = await SignAsync(x, letter.Id);
        Assert.Equal(("Signed", f.Other), (signed.Status, signed.SignedBy));
        var code = signed.SignatureCode!;
        f.As(x.Clerk);
        var signedVersion = await VersionAsync(x, letter.Id);
        Assert.Equal("invalid_letter_state", (await Assert.ThrowsAsync<DomainException>(() => x.Letters.ReviseAsync(x.Parish, letter.Id, Revise(signedVersion), default))).Code);
        Assert.Equal("NotYetIssued", (await x.Signatures.VerifyAsync(code, default)).Status);
        // Signed is not released: the tracking link still lists nothing.
        Assert.Empty(await x.Letters.GuestAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default));

        f.As(x.Releaser);
        var hash = (await x.Letters.PreviewAsync(x.Parish, letter.Id, default)).ContentHash;
        Assert.Equal("release_mismatch", (await Assert.ThrowsAsync<DomainException>(() => ReleaseAsync(x, letter.Id, hash, r => r.ConfirmAddresseeName = "Another person"))).Code);
        Assert.Equal("release_mismatch", (await Assert.ThrowsAsync<DomainException>(() => ReleaseAsync(x, letter.Id, new string('B', 64)))).Code);
        Assert.Equal("invalid_letter_state", (await Assert.ThrowsAsync<DomainException>(() => ReleaseAsync(x, letter.Id, hash, r => r.Method = "VerifiedAccount"))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ReleaseAsync(x, letter.Id, hash, r => r.VerificationEvidence = null))).Code);
        Assert.Equal("Signed", (await x.Letters.ListAsync(x.Parish, receipt.RequestId, default))[0].Value.Status);
        var released = await ReleaseAsync(x, letter.Id, hash);
        Assert.Equal(("Released", "InPerson", x.Releaser), (released.Status, released.ReleaseMethod, released.ReleasedBy));

        var tracked = Assert.Single(await x.Letters.GuestAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default));
        Assert.Equal(("Released", (string?)null, (string?)null), (tracked.Status, tracked.Body, tracked.VerificationCode));
        var guestJson = JsonSerializer.Serialize(tracked);
        Assert.DoesNotContain("Isolated letter body", guestJson);
        Assert.DoesNotContain(code, guestJson);
        await Assert.ThrowsAsync<DomainException>(() => x.Letters.GuestAsync(x.Parish, receipt.RequestId, "wrong-token", default));

        var verified = await x.Signatures.VerifyAsync(code, default);
        Assert.Equal(("Valid", "Letter", "Fr. Isolated Priest, Parish priest"), (verified.Status, verified.DocumentType, verified.AuthorizedBy));
        Assert.DoesNotContain("Isolated letter body", JsonSerializer.Serialize(verified));
        Assert.DoesNotContain("Isolated guest", JsonSerializer.Serialize(verified));

        var withdrawn = await x.Letters.WithdrawAsync(x.Parish, letter.Id, new WithdrawLetterDto { OperationId = Guid.NewGuid(), Version = await VersionAsync(x, letter.Id), Reason = "Released to the wrong person" }, default);
        Assert.Equal(("Withdrawn", x.Releaser, "InPerson"), (withdrawn.Status, withdrawn.WithdrawnBy, withdrawn.ReleaseMethod));
        Assert.Equal("Withdrawn", (await x.Letters.GuestAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default))[0].Status);
        Assert.Contains("cannot be recalled", (await x.Letters.GuestAsync(x.Parish, receipt.RequestId, receipt.TrackingToken, default))[0].Statement);
        Assert.Equal("Withdrawn", (await x.Signatures.VerifyAsync(code, default)).Status);
    }

    [Fact]
    public async Task Account_applicants_receive_the_text_replacements_supersede_and_revoked_authorizations_block_release()
    {
        await using var f = await StartAsync();
        var x = await CreateAsync(f);
        var member = await f.CreateVerifiedMemberAsync();
        f.As(member, mfa: false);
        var submitted = await x.Requests.SubmitAsync(x.Parish, new SubmitRequestDto
        {
            OperationId = Guid.NewGuid(), Kind = "General", Summary = "Isolated request", Details = new() { ["note"] = "Isolated details" }
        }, default);

        f.As(x.Clerk);
        var letter = await x.Letters.CreateAsync(x.Parish, submitted.Id, Draft("Isolated member"), default);
        var version = await VersionAsync(x, letter.Id);
        await x.Letters.ReviseAsync(x.Parish, letter.Id, Revise(version, "Isolated member"), default);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => x.Letters.ReviseAsync(x.Parish, letter.Id, Revise(version, "Isolated member"), default))).Code);
        x.Signer();
        var first = await SignAsync(x, letter.Id);
        f.As(x.Releaser);
        var hash = (await x.Letters.PreviewAsync(x.Parish, letter.Id, default)).ContentHash;
        await ReleaseAsync(x, letter.Id, hash, r => { r.Method = "VerifiedAccount"; r.ConfirmAddresseeName = "Isolated member"; r.VerificationEvidence = null; });

        f.As(member, mfa: false);
        var mine = Assert.Single(await x.Letters.MineAsync(x.Parish, submitted.Id, default));
        Assert.Equal(("Released", "Corrected letter body", first.SignatureCode, "Fr. Isolated Priest"), (mine.Status, mine.Body, mine.VerificationCode, mine.SignerName));
        Assert.Contains("wet-signed and sealed paper", mine.Statement);
        await Assert.ThrowsAsync<DomainException>(() => x.Letters.ListAsync(x.Parish, submitted.Id, default));
        f.As(await f.CreateVerifiedMemberAsync(), mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => x.Letters.MineAsync(x.Parish, submitted.Id, default));

        // A replacement is a new reference and version; once signed, the earlier letter reports Superseded and its text is no longer served.
        f.As(x.Clerk);
        var replacement = Draft("Isolated member");
        replacement.ReplacesLetterId = Guid.Parse(letter.Id);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Letters.CreateAsync(x.Parish, submitted.Id, replacement, default))).Code);
        replacement.ReplaceReason = "Date corrected";
        var second = await x.Letters.CreateAsync(x.Parish, submitted.Id, replacement, default);
        Assert.Equal((2, letter.Id), (second.Version, second.ReplacesId));
        Assert.NotEqual(letter.Reference, second.Reference);
        x.Signer();
        var secondSigned = await SignAsync(x, second.Id);
        Assert.Equal("Superseded", (await x.Signatures.VerifyAsync(first.SignatureCode!, default)).Status);
        f.As(member, mfa: false);
        var old = (await x.Letters.MineAsync(x.Parish, submitted.Id, default)).Single(l => l.Version == 1);
        Assert.Equal(("Superseded", (string?)null), (old.Status, old.Body));

        // A revoked authorization cannot be released; a current priest (or the bishop) revokes, and the record stays.
        x.Signer();
        await x.Signatures.RevokeAsync(x.Parish, secondSigned.SignatureCode!, new RevokeSignatureDto { OperationId = Guid.NewGuid(), Reason = "Isolated revocation" }, default);
        f.As(x.Releaser);
        var secondHash = (await x.Letters.PreviewAsync(x.Parish, second.Id, default)).ContentHash;
        Assert.Equal("invalid_letter_state", (await Assert.ThrowsAsync<DomainException>(() => ReleaseAsync(x, second.Id, secondHash, r => r.ConfirmAddresseeName = "Isolated member"))).Code);
        Assert.Equal("Revoked", (await x.Signatures.GetAsync(x.Parish, secondSigned.SignatureCode!, default)).Value.Status);
    }

    [Fact]
    public async Task Public_routes_verify_codes_anonymously_and_require_the_tracking_header()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var receipt = await x.Requests.GuestSubmitAsync(x.Parish, Guest(), default);
        f.As(x.Clerk);
        var letter = await x.Letters.CreateAsync(x.Parish, receipt.RequestId, Draft(), default);
        x.Signer();
        var code = (await SignAsync(x, letter.Id)).SignatureCode!;

        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var anonymous = factory.Client();
        var verified = await anonymous.GetAsync($"/api/public/document-verifications/{code}");
        Assert.Equal(HttpStatusCode.OK, verified.StatusCode);
        var json = await verified.Content.ReadAsStringAsync();
        Assert.Contains("\"NotYetIssued\"", json);
        Assert.DoesNotContain("Isolated letter body", json);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/document-verifications/{new string('0', 32)}")).StatusCode);
        var path = $"/api/public/parishes/{x.Parish}/requests/{receipt.RequestId}/letters";
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync(path)).StatusCode);
        using var tracked = new HttpRequestMessage(HttpMethod.Get, path);
        tracked.Headers.Add("X-ParishLife-Tracking", receipt.TrackingToken);
        Assert.Equal("[]", await (await anonymous.SendAsync(tracked)).Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/parishes/{x.Parish}/requests/{receipt.RequestId}/letters")).StatusCode);
    }

    private static CreateLetterDto Draft(string addressee = "Isolated guest") => new()
    {
        OperationId = Guid.NewGuid(), Title = "Isolated attestation", Body = "Isolated letter body", Language = "en", AddresseeName = addressee
    };

    private static ReviseLetterDto Revise(string version, string addressee = "Isolated guest") => new()
    {
        OperationId = Guid.NewGuid(), Version = version, Title = "Isolated attestation", Body = "Corrected letter body", AddresseeName = addressee
    };

    private static GuestRequestDto Guest() => new()
    {
        OperationId = Guid.NewGuid(), Kind = "General", Summary = "Attestation letter", Details = new() { ["purpose"] = "Isolated purpose" },
        RequesterName = "Isolated guest", RequesterContact = "guest@fixture.example", SubjectDescription = "Myself"
    };

    private static async Task<LetterDto> SignAsync(Setup x, string id) => await x.Letters.SignAsync(x.Parish, id, new AuthorizeDocumentDto
    {
        OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), ExpectedContentHash = (await x.Letters.PreviewAsync(x.Parish, id, default)).ContentHash,
        AuthenticatorCode = TestAuthenticator.Code()
    }, default);

    private static async Task<LetterDto> ReleaseAsync(Setup x, string id, string hash, Action<ReleaseLetterDto>? configure = null)
    {
        var request = new ReleaseLetterDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync(x, id), Method = "InPerson", ConfirmContentHash = hash, ConfirmAddresseeName = "Isolated guest",
            ConfirmRequestReference = (await x.Letters.PreviewAsync(x.Parish, id, default)).Content["requestReference"],
            VerificationEvidence = "Identity card checked at the office"
        };
        configure?.Invoke(request);
        return await x.Letters.ReleaseAsync(x.Parish, id, request, default);
    }

    private static async Task<LocalBackendFixture> StartAsync()
    {
        var f = new LocalBackendFixture();
        await f.InitializeAsync();
        return f;
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f, bool profile = true)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "requests"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.RequestsManage]));
        var x = new Setup(f, staff, appointment.Id, await GrantAsync(staff, [Permissions.RequestsManage]), await GrantAsync(staff, [Permissions.DocumentsRelease]));
        if (profile)
        {
            f.As(f.Other);
            await x.Signatures.SaveProfileAsync(new SaveSignerProfileDto { OperationId = Guid.NewGuid(), PrintedName = "Fr. Isolated Priest" }, default);
        }
        return x;
    }

    private static async Task<string> GrantAsync(StaffAppointmentScenario staff, string[] allows)
    {
        var account = await staff.Fixture.CreateVerifiedStaffAsync();
        staff.Fixture.As(staff.Fixture.FirstAdmin);
        await staff.Fixture.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version, AccountId = Guid.Parse(account),
            Allows = allows, StartsAt = staff.Fixture.Clock.Now
        }, default);
        return account;
    }

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync(Setup x, string id)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<RequestLetter>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, "requestLetter:" + id, default))!.Version;
}
