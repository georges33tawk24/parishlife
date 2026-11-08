// Purpose: verifies staff endpoints through real cookies, MFA, CSRF, selected-capacity headers and isolated persistent storage.
// Main test: Bishop_invites_priest_who_accepts_and_uses_only_selected_duties_until_revocation; helpers perform actual authentication and typed HTTP reads.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class StaffAppointmentHttpTests
{
    private const string Password = "isolated-fixture-long-password";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    [Fact]
    public async Task Bishop_invites_priest_who_accepts_and_uses_only_selected_duties_until_revocation()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var scenario = await StaffAppointmentScenario.CreateAsync(fixture);
        await scenario.ActivateOfficeAsync();
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var bishop = factory.Client();
        using var priest = factory.Client();
        await SignInAsync(bishop, "nominee@fixture.example");
        await SignInAsync(priest, "other@fixture.example");
        var root = $"/api/archdioceses/{scenario.Organization}/parishes/{scenario.Parish}/priest-appointments";
        var scope = await ReadAsync<Versioned<AppointmentScopeDto>>(await bishop.GetAsync(root + "/scope"));
        Assert.Equal(scenario.Parish, scope.Value.ParishId);
        Assert.Equal(HttpStatusCode.Forbidden, (await priest.GetAsync(root + "/scope")).StatusCode);
        var invitation = await ReadAsync<StaffAppointmentDto>(await bishop.PostAsJsonAsync(root, new InviteStaffAppointmentDto
        {
            OperationId = Guid.NewGuid(),
            ScopeVersion = scope.Version,
            AccountId = Guid.Parse(fixture.Other),
            Role = StaffAppointmentRole.Priest,
            Allows = [Permissions.PeopleRead],
            StartsAt = fixture.Clock.Now,
            EndsAt = fixture.Clock.Now.AddDays(20),
            AcceptBy = fixture.Clock.Now.AddDays(1),
            IsHead = true,
            Reason = "Isolated HTTP appointment",
            EvidenceReference = "isolated HTTP appointment evidence",
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code()
        }));
        Assert.Equal("Invited", invitation.Status);
        Assert.NotNull(invitation.EvidenceReference);
        var directory = await ReadAsync<Page<Versioned<StaffAppointmentDto>>>(await priest.GetAsync("/api/auth/staff-appointments?size=1"));
        Assert.Equal(invitation.Id, Assert.Single(directory.Items).Value.Id);
        Assert.Null(directory.Items[0].Value.EvidenceReference);
        var path = root + "/" + invitation.Id;
        var row = await ReadAsync<Versioned<StaffAppointmentDto>>(await priest.GetAsync(path));
        Assert.Equal(HttpStatusCode.BadRequest, (await priest.PostAsJsonAsync(path + "/response", new
        {
            operationId = Guid.NewGuid(),
            version = row.Version
        })).StatusCode);
        priest.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        var response = new DecideStaffAppointmentDto { OperationId = Guid.NewGuid(), Version = row.Version, Accept = true };
        Assert.Equal(HttpStatusCode.BadRequest, (await priest.PostAsJsonAsync(path + "/response", response)).StatusCode);
        await CsrfAsync(priest);
        var accepted = await ReadAsync<StaffAppointmentDto>(await priest.PostAsJsonAsync(path + "/response", response));
        Assert.True(accepted.Effective);
        Assert.True(accepted.Head);
        var people = $"/api/parishes/{scenario.Parish}/people";
        Assert.Equal(HttpStatusCode.NotFound, (await priest.GetAsync(people)).StatusCode);
        priest.DefaultRequestHeaders.Add("X-ParishLife-Appointment", Guid.Parse(invitation.Id).ToString("D"));
        Assert.Empty((await ReadAsync<Page<PersonDto>>(await priest.GetAsync(people))).Items);
        Assert.True((await ReadAsync<AppointmentWorkspaceDto>(await priest.GetAsync(path + "/workspace"))).Appointment.Head);
        Assert.Equal(HttpStatusCode.NotFound, (await priest.PostAsJsonAsync(people, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(),
            GivenName = "Isolated",
            FamilyName = "Denied write"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await priest.GetAsync("/api/administration/readiness")).StatusCode);
        priest.DefaultRequestHeaders.Remove("X-ParishLife-Appointment");
        priest.DefaultRequestHeaders.Add("X-ParishLife-Appointment", "invalid");
        Assert.Equal(HttpStatusCode.BadRequest, (await priest.GetAsync(people)).StatusCode);
        priest.DefaultRequestHeaders.Remove("X-ParishLife-Appointment");
        priest.DefaultRequestHeaders.Add("X-ParishLife-Appointment", invitation.Id);
        row = await ReadAsync<Versioned<StaffAppointmentDto>>(await bishop.GetAsync(path));
        var action = new ActStaffAppointmentDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            Action = StaffAppointmentAction.Revoke,
            Reason = "Isolated HTTP revocation",
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code()
        };
        var revoked = await ReadAsync<StaffAppointmentDto>(await bishop.PostAsJsonAsync(path + "/actions", action));
        Assert.Equal("Revoked", revoked.Status);
        Assert.Equal(HttpStatusCode.NotFound, (await priest.GetAsync(people)).StatusCode);
        var openApi = await ReadAsync<JsonElement>(await bishop.GetAsync("/openapi/v1.json"));
        var schemas = openApi.GetProperty("components").GetProperty("schemas");
        Assert.True(schemas.GetProperty("StaffAppointmentDto").GetProperty("properties").TryGetProperty("effective", out _));
        Assert.True(schemas.GetProperty("InviteStaffAppointmentDto").GetProperty("properties").TryGetProperty("currentCode", out _));
        Assert.False(schemas.TryGetProperty("ParishUser", out _));
        Assert.False(schemas.TryGetProperty("StaffAppointment", out _));
    }

    private static async Task SignInAsync(HttpClient client, string username)
    {
        await CsrfAsync(client);
        var pending = await ReadAsync<JsonElement>(await client.PostAsJsonAsync("/api/auth/login", new { username, password = Password }));
        var challenge = pending.GetProperty("challenge");
        await ReadAsync<JsonElement>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
        {
            accountId = challenge.GetProperty("accountId").GetString(),
            challenge = challenge.GetProperty("challenge").GetString(),
            code = TestAuthenticator.Code()
        }));
        await CsrfAsync(client);
    }

    private static async Task CsrfAsync(HttpClient client)
    {
        var response = await ReadAsync<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", response.GetProperty("token").GetString());
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }
}
