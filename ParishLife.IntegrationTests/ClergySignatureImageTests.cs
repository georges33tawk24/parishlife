// Purpose: verifies the priest's signature image in isolated real storage: only the priest uploads, replaces, reads and removes their own
// image (checked by content, private, versions kept); signing a certificate attaches the image current at that moment, certificate readers
// alone read it, a return clears it, and the HTTP routes need a signed-in, MFA, selected-capacity priest. The image is never an
// electronic signature: it does not enter the electronic authorization content.
// Main tests: own-image lifecycle and denials, certificate attachment and readers, HTTP multipart upload and the requirement routes.

using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
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

public class ClergySignatureImageTests
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4];
    private static readonly byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 5, 6, 7, 8];

    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string Appointment, string Secretary)
    {
        public ClergySignatureImageService Images => F.Services.GetRequiredService<ClergySignatureImageService>();
        public CertificateService Certificates => F.Services.GetRequiredService<CertificateService>();
        public SacramentService Sacraments => F.Services.GetRequiredService<SacramentService>();
        public string Parish => Staff.Parish;
        public void Priest() => F.AsAppointment(F.Other, Appointment);
    }

    [Fact]
    public async Task Only_the_priest_keeps_their_own_private_image_checked_by_content_with_versions_retained()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        f.As(x.Secretary);
        Assert.Equal("clergy_authority_required", (await Assert.ThrowsAsync<DomainException>(() => x.Images.UploadAsync(x.Parish, Guid.NewGuid(), "image/png", Png, default))).Code);
        await Assert.ThrowsAsync<DomainException>(() => x.Images.MineAsync(x.Parish, default));
        f.As(f.Other, false);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => x.Images.UploadAsync(x.Parish, Guid.NewGuid(), "image/png", Png, default))).Code);

        x.Priest();
        Assert.False((await x.Images.MineAsync(x.Parish, default)).HasImage);
        Assert.Equal("invalid_file", (await Assert.ThrowsAsync<DomainException>(() => x.Images.UploadAsync(x.Parish, Guid.NewGuid(), "application/pdf", "%PDF-1.4 x"u8.ToArray(), default))).Code);
        Assert.Equal("invalid_file", (await Assert.ThrowsAsync<DomainException>(() => x.Images.UploadAsync(x.Parish, Guid.NewGuid(), "image/jpeg", Png, default))).Code);
        Assert.Equal("invalid_file", (await Assert.ThrowsAsync<DomainException>(() => x.Images.UploadAsync(x.Parish, Guid.NewGuid(), "image/png", new byte[ClergySignatureImageService.MaximumBytes + 1], default))).Code);
        var operation = Guid.NewGuid();
        var first = await x.Images.UploadAsync(x.Parish, operation, "image/png", Png, default);
        Assert.True(first.HasImage);
        Assert.Contains("not an electronic signature", first.Statement);
        // A retry returns the same image; the same operation can never attach other bytes.
        Assert.Equal(first.Id, (await x.Images.UploadAsync(x.Parish, operation, "image/png", Png, default)).Id);
        await Assert.ThrowsAsync<DomainException>(() => x.Images.UploadAsync(x.Parish, operation, "image/jpeg", Jpeg, default));
        Same(Png, "image/png", await x.Images.MyContentAsync(x.Parish, default));

        var second = await x.Images.UploadAsync(x.Parish, Guid.NewGuid(), "image/jpeg", Jpeg, default);
        Same(Jpeg, "image/jpeg", await x.Images.MyContentAsync(x.Parish, default));
        var old = await Read<ClergySignatureImage>(x, "signatureImage:" + first.Id);
        Assert.Equal(("Replaced", second.Id), (old.Status, old.ReplacedById));

        Assert.Equal("version_required", (await Assert.ThrowsAsync<DomainException>(() => x.Images.RemoveAsync(x.Parish, new RemoveSignatureImageDto { OperationId = Guid.NewGuid() }, default))).Code);
        var removed = await x.Images.RemoveAsync(x.Parish, new RemoveSignatureImageDto { OperationId = Guid.NewGuid(), Version = second.Version! }, default);
        Assert.False(removed.HasImage);
        Assert.Equal("Removed", (await Read<ClergySignatureImage>(x, "signatureImage:" + second.Id)).Status);
        Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => x.Images.MyContentAsync(x.Parish, default))).Code);
    }

    [Fact]
    public async Task Signing_attaches_the_current_image_for_certificate_readers_only_and_a_return_clears_it()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var (person, record) = await RegisteredAsync(x);

        // Signed without an image: nothing attached.
        f.As(x.Secretary);
        var plain = await x.Certificates.CreateAsync(x.Parish, Request(person, record), default);
        Assert.Equal(f.Clock.Now, plain.CreatedAt);
        Assert.Equal(x.Secretary, plain.CreatedBy);
        Assert.False((await PrepareAndSignAsync(x, plain.Id)).HasSignatureImage);
        f.As(x.Secretary);
        Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => x.Certificates.SignatureImageAsync(x.Parish, plain.Id, default))).Code);

        x.Priest();
        await x.Images.UploadAsync(x.Parish, Guid.NewGuid(), "image/png", Png, default);
        f.As(x.Secretary);
        var certificate = await x.Certificates.CreateAsync(x.Parish, Request(person, record), default);
        var signed = await PrepareAndSignAsync(x, certificate.Id);
        Assert.True(signed.HasSignatureImage);

        // A later replacement never changes what a signed certificate carries. (Identities set inside awaited helpers do not flow back.)
        x.Priest();
        await x.Images.UploadAsync(x.Parish, Guid.NewGuid(), "image/jpeg", Jpeg, default);
        f.As(x.Secretary);
        Same(Png, "image/png", await x.Certificates.SignatureImageAsync(x.Parish, certificate.Id, default));
        var stranger = await f.CreateVerifiedStaffAsync();
        f.As(stranger);
        await Assert.ThrowsAsync<DomainException>(() => x.Certificates.SignatureImageAsync(x.Parish, certificate.Id, default));
        f.As(x.Secretary, false);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => x.Certificates.SignatureImageAsync(x.Parish, certificate.Id, default))).Code);

        // The bishop reviewing the certificate reads the attached image too, and returns it.
        f.As(f.Nominee);
        Same(Png, "image/png", await x.Certificates.SignatureImageAsync(x.Parish, certificate.Id, default));
        var returned = await ActAsync(x, certificate.Id, "return", r => r.Reason = "Spelling to check");
        Assert.False(returned.HasSignatureImage);
        Assert.Null((await Read<Certificate>(x, "certificate:" + certificate.Id)).SignatureImageId);
    }

    [Fact]
    public async Task Http_routes_need_a_signed_in_priest_and_serve_only_their_own_image()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var priest = factory.Client();
        await AuthHttp.LoginAsync(priest, "other@fixture.example");
        priest.DefaultRequestHeaders.Add("X-ParishLife-Appointment", Guid.Parse(x.Appointment).ToString("D"));
        var path = $"/api/parishes/{x.Parish}/clergy-signature-image";
        Assert.Equal(HttpStatusCode.NotFound, (await priest.GetAsync(path + "/content")).StatusCode);
        using (var body = Multipart(Png, "image/png"))
        {
            var saved = await AuthHttp.Read<ClergySignatureImageDto>(await priest.PostAsync(path, body));
            Assert.Equal(("image/png", Png.Length), (saved.ContentType, (int)saved.Size));
        }
        using (var body = Multipart(Png, "image/jpeg"))
            Assert.Equal(HttpStatusCode.BadRequest, (await priest.PostAsync(path, body)).StatusCode);
        var content = await priest.GetAsync(path + "/content");
        Assert.Equal(Png, await content.Content.ReadAsByteArrayAsync());
        Assert.Contains("no-store", content.Headers.CacheControl?.ToString() ?? string.Join(",", content.Headers.GetValues("Cache-Control")));
        Assert.True((await AuthHttp.Read<ClergySignatureImageDto>(await priest.GetAsync(path))).HasImage);

        var requirements = $"/api/parishes/{x.Parish}/sacraments/requirements";
        var set = await AuthHttp.Read<RequirementSetDto>(await priest.PutAsJsonAsync(requirements, new SaveRequirementSetDto
        {
            OperationId = Guid.NewGuid(), Sacrament = "Confirmation", Items = [new RequirementItemDto { Key = "k1", LabelAr = "متطلب" }]
        }));
        Assert.Equal("Confirmation", Assert.Single(await AuthHttp.Read<RequirementSetDto[]>(await priest.GetAsync(requirements))).Sacrament);
        Assert.Equal("متطلب", set.Items[0].LabelAr);

        using var anonymous = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path + "/content")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(requirements)).StatusCode);
    }

    private static void Same(byte[] content, string type, (byte[] Content, string ContentType) actual)
    {
        Assert.Equal(content, actual.Content);
        Assert.Equal(type, actual.ContentType);
    }

    private static MultipartFormDataContent Multipart(byte[] content, string type)
    {
        var body = new MultipartFormDataContent();
        body.Add(new StringContent(Guid.NewGuid().ToString()), "operationId");
        var bytes = new ByteArrayContent(content);
        bytes.Headers.ContentType = new MediaTypeHeaderValue(type);
        body.Add(bytes, "file", "signature");
        return body;
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
        var x = new Setup(f, staff, appointment.Id, secretary);
        x.Priest();
        await x.Sacraments.SetPolicyAsync(x.Parish, new NumberingPolicyDto
        {
            OperationId = Guid.NewGuid(), Sacrament = "Baptism", Format = "BAP-{n}", PerYear = false, ApprovalReference = "Isolated numbering decision"
        }, default);
        return x;
    }

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

    private static CreateCertificateDto Request(string person, string record) => new()
    {
        OperationId = Guid.NewGuid(), Sacrament = "Baptism", SubjectPersonId = Guid.Parse(person), SourceRecordId = Guid.Parse(record), Language = "en", Quantity = 1
    };

    // Leaves the priest acting, so callers set the identity they need next.
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

    private static async Task<T> Read<T>(Setup x, string key)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<T>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, key, default))!.Value;

    private static async Task<string> VersionAsync<T>(Setup x, string key)
        => (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<T>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, key, default))!.Version;
}
