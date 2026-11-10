// Purpose: verifies electronic authorization of exact certificate versions (X03) and public verification/revocation (X05) through the real
// local certificate workflow, Identity accounts, Data Protection and storage.
// Main tests: signer setup and exact-content authorization by the signing priest with a fresh authenticator code; minimal public verification
// that follows issue, withdrawal, return and reissue without exposing personal data; the bishop's arrangement deciding the official statement;
// append-only revocation; tamper detection; refusals for the wrong actor, recovery sessions, stale versions and changed content; exact replay.

using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Documents;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Documents;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.Sacraments;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class DocumentSignatureTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Secretary, string Releaser)
    {
        public CertificateService Certificates => F.Services.GetRequiredService<CertificateService>();
        public DocumentSignatureService Signatures => F.Services.GetRequiredService<DocumentSignatureService>();
        public string Parish => Staff.Parish;
        public void Priest() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task The_signing_priest_authorizes_the_exact_version_and_verification_follows_issue_and_withdrawal()
    {
        await using var f = await StartAsync();
        var x = await CreateAsync(f);
        var id = await SignedCertificateAsync(x);

        x.Priest();
        var preview = await x.Certificates.AuthorizationPreviewAsync(x.Parish, id, default);
        Assert.Equal(("Certificate", "Isolated Child", "Isolated church"), (preview.DocumentType, preview.Content["subjectName"], preview.Content["fact.place"]));
        // No signer setup yet.
        Assert.Equal("signer_profile_required", (await Assert.ThrowsAsync<DomainException>(() => AuthorizeAsync(x, id, preview.ContentHash))).Code);
        // Signer setup is personal: not in a selected capacity and not from a recovery session.
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Signatures.SaveProfileAsync(Profile("Fr. Isolated Priest"), default))).Kind);
        f.AsRecovery(f.Other);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => x.Signatures.SaveProfileAsync(Profile("Fr. Isolated Priest"), default))).Code);
        f.As(f.Other);
        await x.Signatures.SaveProfileAsync(Profile("Fr. Isolated Priest"), default);

        x.Priest();
        Assert.Equal("document_content_changed", (await Assert.ThrowsAsync<DomainException>(() => AuthorizeAsync(x, id, new string('A', 64)))).Code);
        Assert.Equal("credentials_invalid", (await Assert.ThrowsAsync<DomainException>(() => AuthorizeAsync(x, id, preview.ContentHash, code: "000000"))).Code);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => AuthorizeAsync(x, id, preview.ContentHash, version: "stale"))).Code);
        f.As(x.Secretary);
        await Assert.ThrowsAsync<DomainException>(() => AuthorizeAsync(x, id, preview.ContentHash));
        f.AsRecovery(f.Other);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => AuthorizeAsync(x, id, preview.ContentHash))).Code);

        x.Priest();
        var request = await AuthorizeRequestAsync(x, id, preview.ContentHash);
        var authorized = await x.Certificates.AuthorizeAsync(x.Parish, id, request, default);
        var code = authorized.AuthorizationCode!;
        Assert.Matches("^[0-9A-F]{32}$", code);
        // An exact retry replays without a second authorization; the authenticator code is not part of the fingerprint.
        request.AuthenticatorCode = "999999";
        Assert.Equal(code, (await x.Certificates.AuthorizeAsync(x.Parish, id, request, default)).AuthorizationCode);
        Assert.Equal([code], (await x.Certificates.GetAsync(x.Parish, id, default)).Value.AuthorizationCodes);
        Assert.Equal("invalid_certificate_state", (await Assert.ThrowsAsync<DomainException>(() => AuthorizeAsync(x, id, preview.ContentHash))).Code);

        // Anyone holding the code may check it; before issue it is not yet valid.
        f.As(await f.CreateVerifiedMemberAsync(), mfa: false);
        var pending = await x.Signatures.VerifyAsync(code.ToLowerInvariant(), default);
        Assert.Equal(("NotYetIssued", "Baptism", false), (pending.Status, pending.DocumentDetail, pending.ElectronicSignatureRecognized));
        Assert.Contains("wet-signed and sealed paper", pending.OfficialStatement);

        f.As(f.Nominee);
        await ActAsync(x, id, "accept");
        f.As(x.Releaser);
        await ActAsync(x, id, "issue");
        var valid = await x.Signatures.VerifyAsync(code, default);
        Assert.Equal(("Valid", "Fr. Isolated Priest, Parish priest", preview.Reference),
            (valid.Status, valid.AuthorizedBy, valid.Reference));
        var json = JsonSerializer.Serialize(valid);
        foreach (var leak in new[] { "Isolated Child", "Isolated church", "Isolated Godparent", f.Other, "subjectPersonId", "ContentHash", "BAP-1" })
            Assert.DoesNotContain(leak, json);

        // The printed sheet names the signing priest and carries the code, without claiming official validity.
        f.As(x.Secretary);
        var html = await f.Services.GetRequiredService<DocumentSheetService>().RenderAsync(x.Parish, id, default);
        Assert.Contains("Electronically authorized by Fr. Isolated Priest, Parish priest", html);
        Assert.Contains(code, html);
        Assert.Contains("COPY: official only as the signed and sealed paper", html);

        f.As(x.Releaser);
        await ActAsync(x, id, "withdraw", r => r.Reason = "Issued to the wrong recipient");
        Assert.Equal("Withdrawn", (await x.Signatures.VerifyAsync(code, default)).Status);

        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Signatures.VerifyAsync("not-a-code", default))).Kind);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => x.Signatures.VerifyAsync(new string('0', 32), default))).Kind);
    }

    [Fact]
    public async Task Returns_invalidate_reissues_supersede_and_the_bishops_arrangement_decides_the_official_statement()
    {
        await using var f = await StartAsync();
        var x = await CreateAsync(f);
        f.As(f.Other);
        await x.Signatures.SaveProfileAsync(Profile("Fr. Isolated Priest"), default);
        var id = await SignedCertificateAsync(x);
        var first = await AuthorizeAsync(x, id);

        // A return clears the authorization; the old code now reports that it no longer matches.
        f.As(f.Nominee);
        await ActAsync(x, id, "return", r => r.Reason = "Spelling to check");
        Assert.Null((await x.Certificates.GetAsync(x.Parish, id, default)).Value.AuthorizationCode);
        Assert.Equal("Invalidated", (await x.Signatures.VerifyAsync(first, default)).Status);

        // Only the bishop records an arrangement, and approval needs the authority's own reference.
        var arrangement = new SignatureArrangementDto { OperationId = Guid.NewGuid(), Approved = true, Reason = "Isolated arrangement decision" };
        x.Priest();
        await Assert.ThrowsAsync<DomainException>(() => x.Signatures.SetArrangementAsync(x.Staff.Organization, arrangement, default));
        f.As(f.Nominee);
        Assert.False((await x.Signatures.ArrangementAsync(x.Staff.Organization, default)).Approved);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Signatures.SetArrangementAsync(x.Staff.Organization, arrangement, default))).Code);
        arrangement.ApprovalReference = "ISOLATED-ARRANGEMENT-1";
        Assert.True((await x.Signatures.SetArrangementAsync(x.Staff.Organization, arrangement, default)).Approved);

        f.As(x.Secretary);
        await ActAsync(x, id, "prepare");
        await ActAsync(x, id, "submit");
        x.Priest();
        await ActAsync(x, id, "sign");
        var second = await AuthorizeAsync(x, id);
        Assert.NotEqual(first, second);
        f.As(f.Nominee);
        await ActAsync(x, id, "accept");
        f.As(x.Releaser);
        await ActAsync(x, id, "issue");
        var recognized = await x.Signatures.VerifyAsync(second, default);
        Assert.Equal(("Valid", true), (recognized.Status, recognized.ElectronicSignatureRecognized));
        Assert.Contains("ISOLATED-ARRANGEMENT-1", recognized.OfficialStatement);
        f.As(x.Secretary);
        Assert.Contains("ELECTRONICALLY AUTHORIZED", await f.Services.GetRequiredService<DocumentSheetService>().RenderAsync(x.Parish, id, default));
        // The earlier authorization keeps the arrangement state in force when it was made.
        x.Priest();
        Assert.Null((await x.Signatures.GetAsync(x.Parish, first, default)).Value.ArrangementReference);

        // Issuing a reissue marks the earlier certificate superseded.
        var current = await x.Certificates.GetAsync(x.Parish, id, default);
        f.As(x.Secretary);
        var reissue = Request(current.Value.SubjectPersonId, current.Value.SourceRecordId!);
        reissue.ReplacesCertificateId = Guid.Parse(id);
        reissue.ReissueReason = "Second copy with corrected purpose";
        var replacement = await x.Certificates.CreateAsync(x.Parish, reissue, default);
        await ActAsync(x, replacement.Id, "prepare");
        await ActAsync(x, replacement.Id, "submit");
        x.Priest();
        await ActAsync(x, replacement.Id, "sign");
        f.As(f.Nominee);
        await ActAsync(x, replacement.Id, "accept");
        f.As(x.Releaser);
        Assert.Equal("Valid", (await x.Signatures.VerifyAsync(second, default)).Status);
        await ActAsync(x, replacement.Id, "issue");
        f.As(x.Secretary);
        Assert.Equal(replacement.Id, (await x.Certificates.GetAsync(x.Parish, id, default)).Value.SupersededById);
        Assert.Equal("Superseded", (await x.Signatures.VerifyAsync(second, default)).Status);
    }

    [Fact]
    public async Task Revocation_is_append_only_restricted_and_private_and_tampering_is_detected()
    {
        await using var f = await StartAsync();
        var x = await CreateAsync(f);
        f.As(f.Other);
        await x.Signatures.SaveProfileAsync(Profile("Fr. Isolated Priest"), default);
        var id = await SignedCertificateAsync(x);
        var code = await AuthorizeAsync(x, id);

        var revoke = new RevokeSignatureDto { OperationId = Guid.NewGuid(), Reason = "Isolated private revocation reason" };
        f.As(x.Secretary);
        await Assert.ThrowsAsync<DomainException>(() => x.Signatures.RevokeAsync(x.Parish, code, revoke, default));
        await Assert.ThrowsAsync<DomainException>(() => x.Signatures.GetAsync(x.Parish, code, default));
        var stranger = await f.CreateVerifiedStaffAsync();
        f.As(stranger);
        await Assert.ThrowsAsync<DomainException>(() => x.Signatures.RevokeAsync(x.Parish, code, revoke, default));

        f.As(f.Nominee);
        var revoked = await x.Signatures.RevokeAsync(x.Parish, code, revoke, default);
        Assert.Equal(("Revoked", f.Nominee, true), (revoked.Status, revoked.RevokedBy, revoked.IntegrityVerified));
        Assert.Equal(revoked.RevokedAt, (await x.Signatures.RevokeAsync(x.Parish, code, revoke, default)).RevokedAt);
        x.Priest();
        Assert.Equal("invalid_signature_state", (await Assert.ThrowsAsync<DomainException>(() =>
            x.Signatures.RevokeAsync(x.Parish, code, new RevokeSignatureDto { OperationId = Guid.NewGuid(), Reason = "Again" }, default))).Code);
        var pub = await x.Signatures.VerifyAsync(code, default);
        Assert.Equal("Revoked", pub.Status);
        Assert.DoesNotContain("Isolated private revocation reason", JsonSerializer.Serialize(pub));

        // A changed stored record no longer matches its content hash and seal.
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish };
        var row = (await records.ReadAsync<DocumentSignature>(scope, "documentSignature:" + code, default))!;
        row.Value.SignerName = "Someone else";
        await records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), "isolated-test", new { code }, f.Clock), "test.tamper", code,
            [RecordChange.Replace("documentSignature:" + code, "documentSignature", row.Value, row.Version)], new CommandResult { Id = code, Status = "Tampered" }, default);
        Assert.Equal(("IntegrityCheckFailed", false), ((await x.Signatures.VerifyAsync(code, default)).Status, (await x.Signatures.VerifyAsync(code, default)).ElectronicSignatureRecognized));
    }

    [Fact]
    public async Task Only_the_priest_who_signed_may_authorize_and_only_with_approved_wording()
    {
        await using var f = await StartAsync();
        var x = await CreateAsync(f, approveTemplate: false);
        f.As(f.Other);
        await x.Signatures.SaveProfileAsync(Profile("Fr. Isolated Priest"), default);
        var id = await SignedCertificateAsync(x);
        x.Priest();
        Assert.Equal("invalid_certificate_state", (await Assert.ThrowsAsync<DomainException>(() => x.Certificates.AuthorizationPreviewAsync(x.Parish, id, default))).Code);

        // A different current priest did not sign this certificate and cannot authorize it.
        var other = await f.CreateVerifiedStaffAsync();
        var appointment = await x.Staff.AcceptAsync(await x.Staff.InviteAsync(other, allows: [Permissions.SacramentsRecord]));
        await ApproveTemplateAsync(x);
        x.Priest();
        var hash = (await x.Certificates.AuthorizationPreviewAsync(x.Parish, id, default)).ContentHash;
        f.As(other);
        await x.Signatures.SaveProfileAsync(Profile("Fr. Other Priest"), default);
        f.AsAppointment(other, appointment.Id);
        Assert.Equal("clergy_authority_required", (await Assert.ThrowsAsync<DomainException>(() => AuthorizeAsync(x, id, hash))).Code);
    }

    private static SaveSignerProfileDto Profile(string name) => new() { OperationId = Guid.NewGuid(), PrintedName = name };

    private static async Task<LocalBackendFixture> StartAsync()
    {
        var f = new LocalBackendFixture();
        await f.InitializeAsync();
        return f;
    }

    private static async Task<string> AuthorizeAsync(Setup x, string id)
    {
        x.Priest();
        var hash = (await x.Certificates.AuthorizationPreviewAsync(x.Parish, id, default)).ContentHash;
        return (await x.Certificates.AuthorizeAsync(x.Parish, id, await AuthorizeRequestAsync(x, id, hash), default)).AuthorizationCode!;
    }

    private static async Task<CertificateDto> AuthorizeAsync(Setup x, string id, string hash, string? code = null, string? version = null)
    {
        var request = await AuthorizeRequestAsync(x, id, hash);
        request.AuthenticatorCode = code ?? request.AuthenticatorCode;
        request.Version = version ?? request.Version;
        return await x.Certificates.AuthorizeAsync(x.Parish, id, request, default);
    }

    private static async Task<AuthorizeDocumentDto> AuthorizeRequestAsync(Setup x, string id, string hash) => new()
    {
        OperationId = Guid.NewGuid(), Version = await VersionAsync<Certificate>(x, "certificate:" + id), ExpectedContentHash = hash, AuthenticatorCode = TestAuthenticator.Code()
    };

    private static async Task<string> SignedCertificateAsync(Setup x)
    {
        var (person, record) = await RegisteredAsync(x);
        x.F.As(x.Secretary);
        var certificate = await x.Certificates.CreateAsync(x.Parish, Request(person, record), default);
        await ActAsync(x, certificate.Id, "prepare");
        await ActAsync(x, certificate.Id, "submit");
        x.Priest();
        await ActAsync(x, certificate.Id, "sign");
        return certificate.Id;
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f, bool approveTemplate = true)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "sacraments"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.SacramentsRecord, Permissions.PeopleRead, Permissions.PeopleWrite]));
        var x = new Setup(f, staff, appointment.Id, await GrantAsync(staff, [Permissions.SacramentsRecord]), await GrantAsync(staff, [Permissions.DocumentsRelease]));
        x.Priest();
        await f.Services.GetRequiredService<SacramentService>().SetPolicyAsync(x.Parish, new NumberingPolicyDto
        {
            OperationId = Guid.NewGuid(), Sacrament = "Baptism", Format = "BAP-{n}", PerYear = false, ApprovalReference = "Isolated numbering decision"
        }, default);
        if (approveTemplate)
            await ApproveTemplateAsync(x);
        return x;
    }

    private static async Task ApproveTemplateAsync(Setup x)
    {
        var sheets = x.F.Services.GetRequiredService<DocumentSheetService>();
        x.Priest();
        await sheets.ProposeAsync(x.Parish, new SaveDocumentTemplateDto { OperationId = Guid.NewGuid(), Kind = "Baptism", Language = "en", Body = "Baptism of {{name}} at {{place}}" }, default);
        x.F.As(x.F.Nominee);
        await sheets.ApproveAsync(x.Parish, "Baptism", "en", default);
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

    private static async Task<(string Person, string Record)> RegisteredAsync(Setup x)
    {
        x.Priest();
        var sacraments = x.F.Services.GetRequiredService<SacramentService>();
        var person = (await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Child", BirthDate = new DateOnly(2026, 5, 1)
        }, default)).Id;
        var record = await sacraments.CreateAsync(x.Parish, new CreateSacramentDto
        {
            OperationId = Guid.NewGuid(), Sacrament = "Baptism", SubjectPersonId = Guid.Parse(person), Facts = new() { ["godparent"] = "Isolated Godparent" }
        }, default);
        foreach (var (action, configure) in new (string, Action<SacramentActionDto>?)[]
        {
            ("accept", null),
            ("record-celebration", r => { r.CelebratedAt = x.F.Clock.Now.AddHours(-1); r.Place = "Isolated church"; r.CelebrantName = "Isolated celebrant"; }),
            ("register", null)
        })
        {
            var request = new SacramentActionDto { OperationId = Guid.NewGuid(), Version = await VersionAsync<SacramentRecord>(x, "sacrament:" + record.Id), Action = action };
            configure?.Invoke(request);
            await sacraments.ActAsync(x.Parish, record.Id, request, default);
        }
        return (person, record.Id);
    }

    private static CreateCertificateDto Request(string person, string record) => new()
    {
        OperationId = Guid.NewGuid(), Sacrament = "Baptism", SubjectPersonId = Guid.Parse(person), SourceRecordId = Guid.Parse(record), Language = "en", Quantity = 1
    };

    private static async Task<CertificateDto> ActAsync(Setup x, string id, string action, Action<CertificateActionDto>? configure = null)
    {
        var request = new CertificateActionDto { OperationId = Guid.NewGuid(), Version = await VersionAsync<Certificate>(x, "certificate:" + id), Action = action };
        configure?.Invoke(request);
        return await x.Certificates.ActAsync(x.Parish, id, request, default);
    }

    // Test-only storage reads supply current versions without granting the acting principal any read authority.
    private static async Task<string> VersionAsync<T>(Setup x, string key)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<T>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, key, default))!.Version;
}
