// Purpose: verifies ministry workflows through real HTTP, persisted Identity cookies, MFA, CSRF and isolated storage.
// Main tests: reviewed identity linking; explicit publication and safe schemas; applicant-to-priest membership/private departure; recovery-cookie denial.
// Helpers authenticate ordinary and MFA accounts, renew CSRF and submit versioned ministry/application actions.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Identity;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MinistryHttpTests
{
    private const string Password = "isolated-fixture-long-password";

    [Fact]
    public async Task Person_link_HTTP_requires_an_independent_authorized_operator_and_prevents_two_accounts_claiming_one_person()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(fixture);
        var account = await fixture.CreateVerifiedMemberAsync();
        var otherAccount = await fixture.CreateVerifiedMemberAsync();
        var username = (await fixture.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(account))!.UserName!;
        s.Use();
        var person = await fixture.Services.GetRequiredService<PeopleService>().CreateAsync(s.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(),
            GivenName = "Isolated",
            FamilyName = "HTTP applicant",
            BirthDate = new DateOnly(1990, 1, 1)
        }, default);
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var priest = factory.Client();
        using var applicant = factory.Client();
        await LoginAsync(priest, "other@fixture.example", mfa: true);
        priest.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        await LoginAsync(applicant, username);
        var path = $"/api/parishes/{s.Parish}/person-account-links";
        var link = new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(),
            AccountId = Guid.Parse(account),
            PersonId = Guid.Parse(person.Id),
            EvidenceReference = "private isolated HTTP identity evidence"
        };
        Assert.False((await applicant.PostAsJsonAsync(path, link)).IsSuccessStatusCode);
        var response = await priest.PostAsJsonAsync(path, link);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        var own = await applicant.GetAsync(path + "/mine");
        Assert.True(own.IsSuccessStatusCode);
        var ownJson = await own.Content.ReadAsStringAsync();
        Assert.Contains(person.Id, ownJson);
        Assert.DoesNotContain("private isolated HTTP identity evidence", ownJson);
        Assert.DoesNotContain("verifiedBy", ownJson);
        Assert.Equal(HttpStatusCode.Conflict, (await priest.PostAsJsonAsync(path, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(),
            AccountId = Guid.Parse(otherAccount),
            PersonId = Guid.Parse(person.Id),
            EvidenceReference = "separate isolated review must not replace a claimed identity"
        })).StatusCode);
    }

    [Fact]
    public async Task Ministry_HTTP_requires_identity_CSRF_and_valid_inputs_and_publishes_only_the_approved_public_projection()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(fixture);
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var priest = factory.Client();
        using var visitor = factory.Client();
        var root = $"/api/parishes/{s.Parish}/ministries";
        var publicPath = $"/api/public/parishes/{s.Parish}/ministries";
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync(root)).StatusCode);
        await LoginAsync(priest, "other@fixture.example", mfa: true);
        priest.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        var create = new SaveMinistryDto
        {
            OperationId = Guid.NewGuid(),
            Name = "Isolated HTTP ministry",
            Kind = "Ministry",
            Purpose = "Approved public description",
            EligibilityPolicyReference = "private reviewed eligibility evidence"
        };
        priest.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await priest.PostAsJsonAsync(root, create)).StatusCode);
        await CsrfAsync(priest);
        Assert.Equal(HttpStatusCode.BadRequest, (await priest.PostAsJsonAsync(root, new SaveMinistryDto
        {
            OperationId = Guid.Empty,
            Name = "",
            Kind = "Ministry",
            Purpose = "Invalid request must not commit"
        })).StatusCode);
        var ministry = await ReadAsync<MinistryDto>(await priest.PostAsJsonAsync(root, create));
        Assert.Equal("Draft", ministry.Status);
        Assert.Empty((await ReadAsync<Page<PublicMinistryDto>>(await visitor.GetAsync(publicPath))).Items);
        await MinistryActionAsync(priest, root, ministry.Id, "approve");
        Assert.Empty((await ReadAsync<Page<PublicMinistryDto>>(await visitor.GetAsync(publicPath))).Items);
        await MinistryActionAsync(priest, root, ministry.Id, "publish");
        var response = await visitor.GetAsync(publicPath);
        var json = await response.Content.ReadAsStringAsync();
        Assert.Equal(ministry.Id, Assert.Single((await ReadAsync<Page<PublicMinistryDto>>(response)).Items).Id);
        Assert.DoesNotContain("eligibilityPolicyReference", json);
        Assert.DoesNotContain("private reviewed eligibility evidence", json);
        Assert.DoesNotContain("createdBy", json);
        Assert.DoesNotContain("accountId", json);
        Assert.DoesNotContain("personId", json);
        Assert.DoesNotContain("membership", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain(fixture.Other, json);
        await MinistryActionAsync(priest, root, ministry.Id, "unpublish");
        Assert.Empty((await ReadAsync<Page<PublicMinistryDto>>(await visitor.GetAsync(publicPath))).Items);

        var openApi = await ReadAsync<JsonElement>(await priest.GetAsync("/openapi/v1.json"));
        var schemas = openApi.GetProperty("components").GetProperty("schemas");
        Assert.True(schemas.TryGetProperty("MinistryDto", out _));
        Assert.True(schemas.TryGetProperty("MinistryApplicationDto", out _));
        Assert.True(schemas.TryGetProperty("PublicMinistryDto", out _));
        Assert.False(schemas.TryGetProperty("Ministry", out _));
        Assert.False(schemas.TryGetProperty("MinistryApplication", out _));
        Assert.False(schemas.TryGetProperty("MinistryMembership", out _));
        Assert.False(schemas.TryGetProperty("PersonAccountLink", out _));
        Assert.False(schemas.TryGetProperty("MinistryPrivateReason", out _));
        Assert.False(schemas.TryGetProperty("ParishUser", out _));
    }

    [Fact]
    public async Task Own_linked_applicant_reaches_direct_priest_membership_and_departure_reason_stays_private()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(fixture);
        var ministry = await s.MinistryAsync();
        var applicant = await s.LinkedApplicantAsync();
        var unrelated = await s.LinkedApplicantAsync();
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var priest = factory.Client();
        using var member = factory.Client();
        using var stranger = factory.Client();
        using var technicalAdmin = factory.Client();
        await LoginAsync(priest, "other@fixture.example", mfa: true);
        priest.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        await LoginAsync(member, applicant.Username);
        await LoginAsync(stranger, unrelated.Username);
        await LoginAsync(technicalAdmin, "colinsleiman", mfa: true);
        var root = $"/api/parishes/{s.Parish}/ministries/{ministry.Id}";
        var applications = root + "/applications";
        var ownLink = await member.GetAsync($"/api/parishes/{s.Parish}/person-account-links/mine");
        Assert.True(ownLink.IsSuccessStatusCode);
        var linkJson = await ownLink.Content.ReadAsStringAsync();
        Assert.Contains(applicant.PersonId, linkJson);
        Assert.DoesNotContain("evidenceReference", linkJson);
        Assert.DoesNotContain("verifiedBy", linkJson);
        var apply = new ApplyMinistryDto { OperationId = Guid.NewGuid(), Kind = "Join" };
        member.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        Assert.False((await member.PostAsJsonAsync(applications, apply)).IsSuccessStatusCode);
        member.DefaultRequestHeaders.Remove("X-ParishLife-Appointment");
        var submitted = await ReadAsync<MinistryApplicationDto>(await member.PostAsJsonAsync(applications, apply));
        Assert.Equal("Submitted", submitted.Status);
        var applicationPath = applications + "/" + submitted.Id;
        Assert.False((await stranger.GetAsync(applicationPath)).IsSuccessStatusCode);
        var approved = await ApplicationActionAsync(priest, applicationPath, "approve");
        Assert.Equal("Approved", approved.Status);
        Assert.Equal("Approved", (await ReadAsync<Versioned<MinistryApplicationDto>>(await member.GetAsync(applicationPath))).Value.Status);
        Assert.Equal("Approved", (await ReadAsync<MinistryApplicationDto>(await member.PostAsJsonAsync(applications, apply))).Status);

        var leave = await ReadAsync<MinistryApplicationDto>(await member.PostAsJsonAsync(applications,
            new ApplyMinistryDto { OperationId = Guid.NewGuid(), Kind = "Leave" }));
        var departurePath = applications + "/" + leave.Id;
        const string privateReason = "Isolated confidential departure explanation";
        var savedReason = await member.PutAsJsonAsync(departurePath + "/private-reason", new PrivateDepartureReasonDto
        {
            OperationId = Guid.NewGuid(),
            Reason = privateReason
        });
        Assert.True(savedReason.IsSuccessStatusCode, await savedReason.Content.ReadAsStringAsync());
        Assert.Equal(privateReason, (await ReadAsync<Versioned<PrivateDepartureDto>>(
            await member.GetAsync(departurePath + "/private-reason"))).Value.Reason);
        Assert.Equal(privateReason, (await ReadAsync<Versioned<PrivateDepartureDto>>(
            await priest.GetAsync(departurePath + "/private-reason"))).Value.Reason);
        foreach (var unauthorized in new[] { stranger, technicalAdmin })
        {
            Assert.False((await unauthorized.GetAsync(departurePath)).IsSuccessStatusCode);
            Assert.False((await unauthorized.GetAsync(departurePath + "/private-reason")).IsSuccessStatusCode);
            var deniedList = await unauthorized.GetAsync(applications + "?kind=Leave");
            Assert.False(deniedList.IsSuccessStatusCode);
            Assert.DoesNotContain(privateReason, await deniedList.Content.ReadAsStringAsync());
        }
        var ordinaryProjection = await ReadAsync<JsonElement>(await member.GetAsync(departurePath));
        Assert.DoesNotContain(privateReason, ordinaryProjection.GetRawText());
        Assert.DoesNotContain("applicantAccountId", ordinaryProjection.GetRawText());
        Assert.DoesNotContain("submittedBy", ordinaryProjection.GetRawText());
        Assert.Equal("Approved", (await ApplicationActionAsync(priest, departurePath, "approve")).Status);
        Assert.Equal("Approved", (await ReadAsync<Versioned<MinistryApplicationDto>>(await member.GetAsync(departurePath))).Value.Status);
    }

    [Fact]
    public async Task Recovery_cookie_cannot_enter_ministry_membership_link_or_private_departure_endpoints()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var s = await MinistryScenario.CreateAsync(fixture);
        var ministry = await s.MinistryAsync();
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var client = factory.Client();
        await LoginAsync(client, "other@fixture.example", mfa: true);
        var codes = await ReadAsync<MfaRecoveryCodesDto>(await client.PostAsJsonAsync("/api/auth/mfa/recovery-codes", new RegenerateRecoveryCodesDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code()
        }));
        await CsrfAsync(client);
        var pending = await ReadAsync<JsonElement>(await client.PostAsJsonAsync("/api/auth/login",
            new { username = "other@fixture.example", password = Password }));
        var challenge = pending.GetProperty("challenge");
        await ReadAsync<RecoverySignInDto>(await client.PostAsJsonAsync("/api/auth/login/mfa/recovery", new CompleteRecoveryLoginDto
        {
            AccountId = Guid.Parse(fixture.Other),
            Challenge = challenge.GetProperty("challenge").GetString()!,
            RecoveryCode = codes.RecoveryCodes[0]
        }));
        await CsrfAsync(client);
        client.DefaultRequestHeaders.Add("X-ParishLife-Appointment", s.Appointment);
        var root = $"/api/parishes/{s.Parish}/ministries";
        var ministryPath = root + "/" + ministry.Id;
        foreach (var path in new[]
        {
            root,
            ministryPath,
            ministryPath + "/applications",
            ministryPath + "/applications/" + Guid.NewGuid().ToString("N") + "/private-reason",
            $"/api/parishes/{s.Parish}/person-account-links/mine"
        })
        {
            var response = await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Equal("recovery_session_restricted", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString());
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync(ministryPath + "/applications",
            new ApplyMinistryDto { OperationId = Guid.NewGuid(), Kind = "Join" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/public/parishes/{s.Parish}/ministries")).StatusCode);
    }

    private static async Task<MinistryDto> MinistryActionAsync(HttpClient client, string root, string ministry, string action)
    {
        var row = await ReadAsync<Versioned<MinistryDto>>(await client.GetAsync(root + "/" + ministry));
        return await ReadAsync<MinistryDto>(await client.PostAsJsonAsync(root + "/" + ministry + "/actions", new MinistryActionDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            Action = action,
            Reason = "Isolated HTTP ministry decision"
        }));
    }

    private static async Task<MinistryApplicationDto> ApplicationActionAsync(HttpClient client, string path, string action)
    {
        var row = await ReadAsync<Versioned<MinistryApplicationDto>>(await client.GetAsync(path));
        return await ReadAsync<MinistryApplicationDto>(await client.PostAsJsonAsync(path + "/actions", new ApplicationActionDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            Action = action,
            Reason = "Isolated HTTP applicant-visible decision",
            EligibilityReviewReference = action == "approve" ? "isolated reviewed eligibility and consent evidence" : null
        }));
    }

    internal static async Task LoginAsync(HttpClient client, string username, bool mfa = false)
    {
        await CsrfAsync(client);
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username, password = Password });
        if (mfa)
        {
            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
            var challenge = (await ReadAsync<JsonElement>(response)).GetProperty("challenge");
            await ReadAsync<AccountDto>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
            {
                accountId = challenge.GetProperty("accountId").GetString(),
                challenge = challenge.GetProperty("challenge").GetString(),
                code = TestAuthenticator.Code()
            }));
        }
        else Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await CsrfAsync(client);
    }

    internal static async Task CsrfAsync(HttpClient client)
    {
        var value = await ReadAsync<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", value.GetProperty("token").GetString());
    }

    internal static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
}
