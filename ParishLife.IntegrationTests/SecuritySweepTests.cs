// Purpose: HTTP regressions for the hardening run's security sweep 1 (hardening/reports/03-security.md, "Sweep 1").
// Main tests: account closure is refused while the account owns a parish or holds parish access, and succeeds once access ends; an
// authenticator code spent on a password reset cannot sign in, and one spent on a sign-in cannot reset a password.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Accounts;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class SecuritySweepTests
{
    private static object Close() => new { operationId = Guid.NewGuid(), currentPassword = Password, currentCode = TestAuthenticator.Code(), confirmation = "CLOSE" };

    [Fact]
    public async Task Closure_is_refused_while_the_account_owns_a_parish_or_holds_access_and_allowed_once_access_ends()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await IndependentParishScenario.CreateAsync(f); // f.Other owns the parish
        var staff = await f.CreateVerifiedStaffAsync();
        f.As(f.Other);
        var parishes = f.Services.GetRequiredService<ParishService>();
        await parishes.GrantAsync(s.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Parishes.GetAsync(s.Parish, default))!.Version,
            AccountId = Guid.Parse(staff), Allows = [Permissions.PeopleRead], StartsAt = f.Clock.Now
        }, default);
        var staffEmail = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(staff))!.Email!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);

        using var owner = factory.Client();
        await LoginAsync(owner, "other@fixture.example");
        var refused = await owner.PostAsJsonAsync("/api/auth/account/close", Close());
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        var problem = await refused.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("closure_responsibilities_held", problem.GetProperty("title").GetString());
        Assert.Contains("parish ownership", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync("/api/auth/me")).StatusCode); // nothing was closed

        using var member = factory.Client();
        await LoginAsync(member, staffEmail);
        var held = await member.PostAsJsonAsync("/api/auth/account/close", Close());
        problem = await held.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("closure_responsibilities_held", problem.GetProperty("title").GetString());
        Assert.Contains("parish access", problem.GetProperty("detail").GetString(), StringComparison.Ordinal);

        f.As(f.Other);
        await parishes.RevokeAsync(s.Parish, new RevokeAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await s.Parishes.GetAsync(s.Parish, default))!.Version, AccountId = Guid.Parse(staff), Reason = "Isolated hand-over"
        }, default);
        Assert.Equal(HttpStatusCode.OK, (await member.PostAsJsonAsync("/api/auth/account/close", Close())).StatusCode);
    }

    [Fact]
    public async Task An_authenticator_code_spent_on_a_reset_cannot_sign_in_and_one_spent_on_a_sign_in_cannot_reset()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var account = (await users.FindByIdAsync(f.Other))!;
        account.EmailConfirmed = true; // controlled setup; the confirmation flow is covered by AccountContactTests
        Assert.True((await users.UpdateAsync(account)).Succeeded);
        var email = account.Email!;
        var delivery = new CapturedContactDelivery();
        await using var factory = new ConfiguredApiFactory(f.DirectoryPath, new(), services => services.AddScoped<IContactCodeDelivery>(_ => delivery));
        using var client = factory.Client();
        await Csrf(client);
        const string newPassword = "a-new-isolated-fixture-password";

        // Reset with the current code, then try to sign in with that same code.
        await client.PostAsJsonAsync("/api/auth/password-reset", new { email });
        var totp = TestAuthenticator.Code();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/password-reset/confirm",
            new { email, code = delivery.Sent[^1].Code, newPassword, currentCode = totp })).StatusCode);
        await Csrf(client);
        var challenge = (await Read<JsonElement>(await client.PostAsJsonAsync("/api/auth/login", new { username = email, password = newPassword }))).GetProperty("challenge");
        var accountId = challenge.GetProperty("accountId").GetString();
        var challengeId = challenge.GetProperty("challenge").GetString();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login/mfa", new { accountId, challenge = challengeId, code = totp })).StatusCode);

        // Sign in with the next step's code (Identity accepts it), then try to reset with that same code.
        var next = TestAuthenticator.Code(step: 1);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/login/mfa", new { accountId, challenge = challengeId, code = next })).StatusCode);
        await Csrf(client);
        await client.PostAsJsonAsync("/api/auth/password-reset", new { email });
        Assert.Equal("verification_invalid", await Title(await client.PostAsJsonAsync("/api/auth/password-reset/confirm",
            new { email, code = delivery.Sent[^1].Code, newPassword = "yet-another-isolated-password", currentCode = next })));
    }
}
