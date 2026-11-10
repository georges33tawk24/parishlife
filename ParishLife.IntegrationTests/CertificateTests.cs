// Purpose: verifies certificates (S14–S15) through real local services and storage.
// Main tests: registered source, preparation snapshot, priest signing, default bishop acceptance, issue and verified release; bishop return,
// bishop policy change, refusal to issue after a source correction, withdrawal and versioned reissue; waiting for a planned entry.

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

public class CertificateTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Secretary, string Releaser)
    {
        public CertificateService Certificates => F.Services.GetRequiredService<CertificateService>();
        public SacramentService Sacraments => F.Services.GetRequiredService<SacramentService>();
        public string Parish => Staff.Parish;
        public void Priest() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task Certificates_pass_preparation_priest_signing_bishop_acceptance_issue_and_verified_release()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var (person, record) = await RegisteredAsync(x);
        f.As(x.Secretary);
        var certificate = await x.Certificates.CreateAsync(x.Parish, Request(person, record), default);
        var prepared = await ActAsync(x, certificate.Id, "prepare");
        Assert.Equal(("Prepared", "BAP-1"), (prepared.Status, prepared.OfficialNumber));
        Assert.Equal("Isolated church", prepared.Snapshot["place"]);
        await ActAsync(x, certificate.Id, "submit");
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, certificate.Id, "sign"));

        x.Priest();
        var signed = await ActAsync(x, certificate.Id, "sign");
        Assert.Equal(("AwaitingBishop", true), (signed.Status, signed.BishopReviewRequired));
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, certificate.Id, "accept"));
        f.As(f.Nominee);
        Assert.Equal("AuthorizedForIssuance", (await ActAsync(x, certificate.Id, "accept")).Status);

        f.As(x.Secretary);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, certificate.Id, "issue"));
        f.As(x.Releaser);
        await ActAsync(x, certificate.Id, "issue");
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, certificate.Id, "release", r =>
        {
            r.RecipientName = "Isolated parent";
            r.RecipientRelationship = "Mother";
            r.VerificationMethod = "InPerson";
        }))).Code);
        var released = await ActAsync(x, certificate.Id, "release", r =>
        {
            r.RecipientName = "Isolated parent";
            r.RecipientRelationship = "Mother";
            r.VerificationMethod = "InPerson";
            r.VerificationEvidence = "Identity card checked at the office";
        });
        Assert.Equal(("Released", x.Releaser), (released.Status, released.ReleasedBy));
        Assert.Contains("wet-signed", released.CopyStatement);

        var stranger = await f.CreateVerifiedStaffAsync();
        f.As(stranger);
        await Assert.ThrowsAsync<DomainException>(() => x.Certificates.GetAsync(x.Parish, certificate.Id, default));
    }

    [Fact]
    public async Task Returns_policy_changes_source_corrections_and_reissues_keep_every_gate()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var (person, record) = await RegisteredAsync(x);
        f.As(x.Secretary);
        var certificate = await x.Certificates.CreateAsync(x.Parish, Request(person, record), default);
        await PrepareAndSignAsync(x, certificate.Id);
        f.As(f.Nominee);
        var returned = await ActAsync(x, certificate.Id, "return", r => r.Reason = "Godparent spelling differs from the register");
        Assert.Equal(("Returned", (string?)null), (returned.Status, returned.SignedBy));

        await x.Certificates.SetPolicyAsync(x.Staff.Organization, new CertificatePolicyDto
        {
            OperationId = Guid.NewGuid(), RequireBishopAcceptance = false, Reason = "Isolated bishop decision for routine extracts"
        }, default);
        Assert.Equal("AuthorizedForIssuance", (await PrepareAndSignAsync(x, certificate.Id)).Status);

        f.As(x.Secretary);
        var correction = await x.Sacraments.ProposeCorrectionAsync(x.Parish, record, new ProposeCorrectionDto
        {
            OperationId = Guid.NewGuid(), Field = "place", NewValue = "Isolated cathedral", Reason = "Wrong church recorded", Evidence = "Isolated register page"
        }, default);
        x.Priest();
        await x.Sacraments.DecideCorrectionAsync(x.Parish, correction.Id, new DecideCorrectionDto
        {
            OperationId = Guid.NewGuid(), Version = await VersionAsync<SacramentCorrection>(x, "sacramentCorrection:" + correction.Id), Approve = true, Note = "Confirmed"
        }, default);
        f.As(x.Releaser);
        Assert.Equal("invalid_certificate_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, certificate.Id, "issue"))).Code);
        x.Priest();
        await ActAsync(x, certificate.Id, "return", r => r.Reason = "Source corrected after preparation");
        Assert.Equal("Isolated cathedral", (await PrepareAndSignAsync(x, certificate.Id)).Snapshot["place"]);
        f.As(x.Releaser);
        await ActAsync(x, certificate.Id, "issue");
        Assert.Equal("Withdrawn", (await ActAsync(x, certificate.Id, "withdraw", r => r.Reason = "Issued with the wrong language")).Status);

        f.As(x.Secretary);
        var reissue = Request(person, record);
        reissue.ReplacesCertificateId = Guid.Parse(certificate.Id);
        reissue.ReissueReason = "Replacement in French";
        reissue.Language = "fr";
        var second = await x.Certificates.CreateAsync(x.Parish, reissue, default);
        Assert.Equal((2, certificate.Id, "Received"), (second.Version, second.ReplacesId, second.Status));
        Assert.NotEqual(certificate.Reference, second.Reference);
    }

    [Fact]
    public async Task Certificates_for_planned_sacraments_wait_for_the_matching_registered_entry()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var (person, record) = await RegisteredAsync(x);
        var (otherPerson, otherRecord) = await RegisteredAsync(x);
        f.As(x.Secretary);
        var waiting = await x.Certificates.CreateAsync(x.Parish, Request(person, null), default);
        Assert.Equal("WaitingForSource", waiting.Status);
        await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, waiting.Id, "prepare"));
        Assert.Equal("invalid_certificate_state", (await Assert.ThrowsAsync<DomainException>(() => ActAsync(x, waiting.Id, "link-source", r => r.SourceRecordId = Guid.Parse(otherRecord)))).Code);
        Assert.Equal("Received", (await ActAsync(x, waiting.Id, "link-source", r => r.SourceRecordId = Guid.Parse(record))).Status);
        Assert.NotEqual(person, otherPerson);
        Assert.Equal("Cancelled", (await ActAsync(x, waiting.Id, "cancel", r => r.Reason = "Family no longer needs it")).Status);
    }

    [Fact]
    public async Task Certificate_sheets_use_only_bishop_approved_wording_escape_values_and_say_draft_or_copy()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var (person, record) = await RegisteredAsync(x);
        f.As(x.Secretary);
        var certificate = await x.Certificates.CreateAsync(x.Parish, Request(person, record), default);
        await ActAsync(x, certificate.Id, "prepare");
        var sheets = f.Services.GetRequiredService<DocumentSheetService>();
        Assert.Equal("invalid_template_state", (await Assert.ThrowsAsync<DomainException>(() => sheets.RenderAsync(x.Parish, certificate.Id, default))).Code);

        x.Priest();
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => sheets.ProposeAsync(x.Parish, Template("{{password}}"), default))).Code);
        await sheets.ProposeAsync(x.Parish, Template("<b>Baptism</b> of {{name}}, register {{officialNumber}}, at {{place}}; godparent {{facts.godparent}}; {{witnesses}}"), default);
        f.As(x.Secretary);
        Assert.Equal("invalid_template_state", (await Assert.ThrowsAsync<DomainException>(() => sheets.RenderAsync(x.Parish, certificate.Id, default))).Code);
        f.As(f.Nominee);
        Assert.Equal("Approved", (await sheets.ApproveAsync(x.Parish, "Baptism", "en", default)).Status);

        f.As(x.Secretary);
        var html = await sheets.RenderAsync(x.Parish, certificate.Id, default);
        Assert.Contains("DRAFT: not valid", html, StringComparison.Ordinal);
        Assert.Contains("&lt;b&gt;Baptism&lt;/b&gt;", html, StringComparison.Ordinal);
        Assert.Contains("register BAP-1, at Isolated church", html, StringComparison.Ordinal);
        Assert.Contains("[witnesses not recorded]", html, StringComparison.Ordinal);
        Assert.DoesNotContain("<b>", html, StringComparison.Ordinal);
    }

    private static SaveDocumentTemplateDto Template(string body) => new() { OperationId = Guid.NewGuid(), Kind = "Baptism", Language = "en", Body = body };

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office", "sacraments"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.SacramentsRecord, Permissions.PeopleRead, Permissions.PeopleWrite]));
        var x = new Setup(f, staff, appointment.Id, await GrantAsync(staff, [Permissions.SacramentsRecord]), await GrantAsync(staff, [Permissions.DocumentsRelease]));
        x.Priest();
        await x.Sacraments.SetPolicyAsync(x.Parish, new NumberingPolicyDto
        {
            OperationId = Guid.NewGuid(), Sacrament = "Baptism", Format = "BAP-{n}", PerYear = false, ApprovalReference = "Isolated numbering decision"
        }, default);
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

    // Opens, accepts, celebrates and registers a baptism through the real sacrament workflow.
    private static async Task<(string Person, string Record)> RegisteredAsync(Setup x)
    {
        x.Priest();
        var person = (await x.F.Services.GetRequiredService<PeopleService>().CreateAsync(x.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Child", BirthDate = new DateOnly(2026, 5, 1)
        }, default)).Id;
        var record = await x.Sacraments.CreateAsync(x.Parish, new CreateSacramentDto
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
            await x.Sacraments.ActAsync(x.Parish, record.Id, request, default);
        }
        return (person, record.Id);
    }

    private static CreateCertificateDto Request(string person, string? record) => new()
    {
        OperationId = Guid.NewGuid(), Sacrament = "Baptism", SubjectPersonId = Guid.Parse(person), SourceRecordId = record is null ? null : Guid.Parse(record),
        Language = "en", Quantity = 1, Purpose = "First Communion preparation"
    };

    private static async Task<CertificateDto> PrepareAndSignAsync(Setup x, string id)
    {
        x.F.As(x.Secretary);
        await ActAsync(x, id, "prepare");
        await ActAsync(x, id, "submit");
        x.Priest();
        return await ActAsync(x, id, "sign");
    }

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
