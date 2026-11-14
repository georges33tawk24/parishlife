// Purpose: verifies My account's own signature image and "My parish records" through real local services, isolated storage and HTTP.
// Main tests: signature create/replace/remove with versions, replay, path-only validation, privacy of receipts/audit and other accounts,
// personal-capacity and recovery denials, CSRF and overposting over HTTP; parish records list only the account's own active link,
// with its own corrections, and nothing for a follower, another account or an acting appointment.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Accounts.Records;
using ParishLife.Api.DTOs.Accounts.Signature;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class AccountSignatureAndRecordsTests
{
    private const string Password = "isolated-fixture-long-password";
    private const string Path = "M10 20Q30.5 40 50 60L70.2 80";

    [Fact]
    public async Task Signature_image_is_versioned_idempotent_path_only_private_and_absent_from_receipts()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        f.As(member, false);
        var service = f.Services.GetRequiredService<AccountSignatureService>();
        var empty = await service.GetAsync(default);
        Assert.True(empty.Eligible);
        Assert.Null(empty.Version);
        Assert.Null(empty.Signature);

        var first = new SaveAccountSignatureDto { OperationId = Guid.NewGuid(), Drawing = Path, Title = "SigTitle", TitleAr = "كاهن الرعية" };
        var saved = await service.SaveAsync(first, default);
        Assert.Equal(Path, saved.Signature!.Drawing);
        Assert.Equal("كاهن الرعية", saved.Signature.TitleAr);
        Assert.NotNull(saved.Version);
        Assert.Equal(saved.Version, (await service.SaveAsync(first, default)).Version); // the same operation replays
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() =>
            service.SaveAsync(new SaveAccountSignatureDto { OperationId = Guid.NewGuid(), Drawing = Path }, default))).Code);
        foreach (var bad in new[] { "M10 20<script>", "L10 20", "M", "M10 20 Z", "M10 20\" onload=\"x" })
            Assert.Equal("invalid_signature", (await Assert.ThrowsAsync<DomainException>(() =>
                service.SaveAsync(new SaveAccountSignatureDto { OperationId = Guid.NewGuid(), Version = saved.Version, Drawing = bad }, default))).Code);
        Assert.Equal("invalid_signature", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(new SaveAccountSignatureDto
        { OperationId = Guid.NewGuid(), Version = saved.Version, Drawing = Path, Title = "two\nlines" }, default))).Code);
        var replaced = await service.SaveAsync(new SaveAccountSignatureDto { OperationId = Guid.NewGuid(), Version = saved.Version, Drawing = Path + "L1 2" }, default);
        Assert.Null(replaced.Signature!.Title);
        Assert.NotEqual(saved.Version, replaced.Version);

        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var scope = new RecordScope { Area = RecordArea.Account, OwnerId = member };
        var metadata = JsonSerializer.Serialize(new
        {
            Receipts = await records.PageAsync<JsonElement>(scope, "operation", 100, null, default),
            Audit = await records.PageAsync<JsonElement>(scope, "audit", 100, null, default)
        });
        foreach (var text in new[] { "Q30.5", "SigTitle", "كاهن" })
            Assert.DoesNotContain(text, metadata);

        // Another account sees only its own (empty) state.
        var other = await f.CreateVerifiedMemberAsync();
        f.As(other, false);
        Assert.Null((await service.GetAsync(default)).Signature);

        f.As(member, false);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() =>
            service.RemoveAsync(new RemoveAccountSignatureDto { OperationId = Guid.NewGuid(), Version = saved.Version! }, default))).Code);
        var remove = new RemoveAccountSignatureDto { OperationId = Guid.NewGuid(), Version = replaced.Version! };
        Assert.Null((await service.RemoveAsync(remove, default)).Signature);
        Assert.Null((await service.RemoveAsync(remove, default)).Signature); // replay
        Assert.Null((await service.GetAsync(default)).Version);

        f.AsRecovery(f.Other);
        Assert.Equal(FailureKind.Forbidden, (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(default))).Kind);
        f.AsAppointment(f.Other, Guid.NewGuid().ToString("N"));
        Assert.Equal(FailureKind.Forbidden, (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(default))).Kind);
        f.As(f.Other, mfa: false); // an MFA account without its MFA session
        await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(default));
    }

    [Fact]
    public async Task Http_signature_requires_sign_in_csrf_and_rejects_overposting()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var anonymous = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/account/signature")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/account/records")).StatusCode);
        using var client = factory.Client();
        await Login(client, "other@fixture.example");
        var empty = await Read<AccountSignatureStatusDto>(await client.GetAsync("/api/account/signature"));
        Assert.Null(empty.Signature);
        var request = new SaveAccountSignatureDto { OperationId = Guid.NewGuid(), Drawing = Path, Title = "HttpTitle" };
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/signature",
            new { request.OperationId, request.Drawing, accountId = f.Nominee })).StatusCode);
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/signature", request)).StatusCode);
        await Csrf(client);
        var saved = await Read<AccountSignatureStatusDto>(await client.PostAsJsonAsync("/api/account/signature", request));
        Assert.Equal("HttpTitle", saved.Signature!.Title);
        var response = await client.GetAsync("/api/account/signature");
        Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
        Assert.Equal(Path, (await Read<AccountSignatureStatusDto>(response)).Signature!.Drawing);
        Assert.Null((await Read<AccountSignatureStatusDto>(await client.PostAsJsonAsync("/api/account/signature/remove",
            new RemoveAccountSignatureDto { OperationId = Guid.NewGuid(), Version = saved.Version! }))).Signature);
        Assert.Empty(await Read<List<AccountParishRecordDto>>(await client.GetAsync("/api/account/records")));
    }

    [Fact]
    public async Task Parish_records_show_only_the_accounts_own_linked_person_and_its_own_corrections()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var appointment = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        var memberships = f.Services.GetRequiredService<MembershipService>();
        var service = f.Services.GetRequiredService<AccountRecordsService>();
        var parish = staff.Parish;

        var member = await f.CreateVerifiedMemberAsync();
        var follower = await f.CreateVerifiedMemberAsync();
        f.As(follower);
        await memberships.FollowAsync(parish, default);
        Assert.Empty(await service.RecordsAsync(default)); // following is not membership

        f.As(member);
        var request = await memberships.RequestAsync(parish, new RequestMembershipDto
        { OperationId = Guid.NewGuid(), GivenName = "RecordGiven", FamilyName = "RecordFamily", BirthDate = new DateOnly(1990, 5, 1) }, default);
        Assert.Empty(await service.RecordsAsync(default)); // a waiting request links nothing
        f.AsAppointment(f.Other, appointment.Id);
        var row = (await memberships.QueueAsync(parish, default)).Single(r => r.Value.Id == request.Id);
        var person = (await memberships.DecideAsync(parish, request.Id, new MembershipDecisionDto
        { OperationId = Guid.NewGuid(), Version = row.Version, Action = "create-person", EvidenceReference = "Office identity check" }, default)).PersonId!;
        // The acting office capacity is not a personal view.
        await Assert.ThrowsAsync<DomainException>(() => service.RecordsAsync(default));

        f.As(member);
        var mine = Assert.Single(await service.RecordsAsync(default));
        Assert.Equal((parish, person, "RecordGiven", "RecordFamily"), (mine.ParishId, mine.PersonId, mine.GivenName, mine.FamilyName));
        Assert.NotEmpty(mine.ParishName);
        Assert.Empty(mine.Corrections);
        await memberships.ProposeCorrectionAsync(parish, new ProposeProfileCorrectionDto
        {
            OperationId = Guid.NewGuid(),
            Fields = [new ProfileCorrectionFieldDto { Field = "Contact", NewValue = "record@fixture.example" }]
        }, default);
        var pending = Assert.Single(Assert.Single(await service.RecordsAsync(default)).Corrections);
        Assert.Equal(("Pending", "Contact"), (pending.Value.Status, Assert.Single(pending.Value.Fields).Field));

        f.As(follower);
        Assert.Empty(await service.RecordsAsync(default));
        f.AsRecovery(member);
        await Assert.ThrowsAsync<DomainException>(() => service.RecordsAsync(default));
    }

    private static async Task Login(HttpClient client, string username)
    {
        await Csrf(client);
        var challenge = (await Read<JsonElement>(await client.PostAsJsonAsync("/api/auth/login", new { username, password = Password }))).GetProperty("challenge");
        await Read<AccountDto>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
        {
            accountId = challenge.GetProperty("accountId").GetString(),
            challenge = challenge.GetProperty("challenge").GetString(),
            code = TestAuthenticator.Code()
        }));
        await Csrf(client);
    }

    private static async Task Csrf(HttpClient client)
    {
        var result = await Read<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", result.GetProperty("token").GetString());
    }

    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
}
