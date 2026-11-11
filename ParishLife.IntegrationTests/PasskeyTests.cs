// Purpose: verifies X01 passkey registration, sign-in and removal through actual HTTP, cookies, CSRF and Identity's passkey handler.
// Main tests: member register/list/sign-in/replay; MFA accounts keep the authenticator step and fresh proofs; recovery/capacity
// restrictions; removal with proof, sign-out and index release; stale-write rollback; cross-session/tampered ceremony rejection.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Accounts;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class PasskeyTests
{
    [Fact]
    public async Task Member_registers_signs_in_with_a_passkey_and_cannot_replay_the_ceremony()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        var username = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(member))!.UserName!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = Browser(factory);
        using var authenticator = new SoftwarePasskey();
        await LoginAsync(client, username);
        var registered = await RegisterAsync(client, authenticator, null);
        Assert.Equal(authenticator.Id, registered.Id);
        Assert.Equal("Laptop", registered.Name);
        var listJson = await (await client.GetAsync("/api/auth/passkeys")).Content.ReadAsStringAsync();
        Assert.Contains(authenticator.Id, listJson);
        Assert.DoesNotContain("publicKey", listJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("signCount", listJson, StringComparison.OrdinalIgnoreCase);

        using var fresh = Browser(factory);
        await Csrf(fresh);
        var ceremony = await Read<PasskeyCeremonyDto>(await fresh.PostAsync("/api/auth/login/passkey/options", null));
        var assertion = new { state = ceremony.State, credential = authenticator.Assert(ceremony.OptionsJson) };
        var account = await Read<AccountDto>(await fresh.PostAsJsonAsync("/api/auth/login/passkey", assertion));
        Assert.Equal(member, account.Id);
        var sessions = await Read<List<AccountSessionDto>>(await fresh.GetAsync("/api/auth/sessions"));
        Assert.Equal("passkey", Assert.Single(sessions, s => s.IsCurrent).AuthenticationMethod);
        Assert.Equal("Active", Assert.Single(sessions, s => s.IsCurrent).Status);
        // The protected ceremony is one-use even for authenticators that never increment their counter.
        using var replay = Browser(factory);
        await Csrf(replay);
        Assert.Equal(HttpStatusCode.Unauthorized, (await replay.PostAsJsonAsync("/api/auth/login/passkey", assertion)).StatusCode);
        // A wrong origin fails verification.
        var other = await Read<PasskeyCeremonyDto>(await replay.PostAsync("/api/auth/login/passkey/options", null));
        Assert.Equal(HttpStatusCode.Unauthorized, (await replay.PostAsJsonAsync("/api/auth/login/passkey",
            new { state = other.State, credential = authenticator.Assert(other.OptionsJson, "https://attacker.example") })).StatusCode);

        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var metadata = JsonSerializer.Serialize(new
        {
            Receipts = await records.PageAsync<JsonElement>(MfaRecoveryService.Scope(member), "operation", 100, null, default),
            Audit = await records.PageAsync<JsonElement>(MfaRecoveryService.Scope(member), "audit", 100, null, default)
        });
        Assert.DoesNotContain(Password, metadata, StringComparison.Ordinal);
        Assert.DoesNotContain("attestationObject", metadata, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Registration_replays_exactly_and_rejects_reused_operations_cross_session_and_tampered_state()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        var username = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(member))!.UserName!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = Browser(factory);
        using var second = Browser(factory);
        using var authenticator = new SoftwarePasskey();
        await LoginAsync(client, username);
        await LoginAsync(second, username);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/auth/passkeys/registration/options",
            new BeginPasskeyRegistrationDto { CurrentPassword = "wrong-isolated-fixture-password" })).StatusCode);
        var options = await Read<PasskeyCeremonyDto>(await client.PostAsJsonAsync("/api/auth/passkeys/registration/options",
            new BeginPasskeyRegistrationDto { CurrentPassword = Password }));
        var request = new CompletePasskeyRegistrationDto { OperationId = Guid.NewGuid(), State = options.State, Credential = authenticator.Attest(options.OptionsJson), Name = "Laptop" };
        // A ceremony started in one session cannot be completed by another session of the same account.
        Assert.Equal("passkey_ceremony_invalid", await Title(await second.PostAsJsonAsync("/api/auth/passkeys/registration", request)));
        Assert.Equal("passkey_ceremony_invalid", await Title(await client.PostAsJsonAsync("/api/auth/passkeys/registration",
            new CompletePasskeyRegistrationDto { OperationId = Guid.NewGuid(), State = options.State[..^4] + "AAAA", Credential = request.Credential })));
        var first = await Read<PasskeyDto>(await client.PostAsJsonAsync("/api/auth/passkeys/registration", request));
        var again = await Read<PasskeyDto>(await client.PostAsJsonAsync("/api/auth/passkeys/registration", request));
        Assert.Equal(first.Id, again.Id);
        request.Name = "Different";
        Assert.Equal("operation_reused", await Title(await client.PostAsJsonAsync("/api/auth/passkeys/registration", request)));
        request.OperationId = Guid.NewGuid();
        Assert.Equal("passkey_invalid", await Title(await client.PostAsJsonAsync("/api/auth/passkeys/registration", request)));
        Assert.Single((await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(member))!.Passkeys);
    }

    [Fact]
    public async Task Mfa_accounts_need_fresh_proofs_and_a_passkey_never_replaces_the_authenticator_step()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = Browser(factory);
        using var authenticator = new SoftwarePasskey(countSignatures: true);
        await LoginAsync(client, "other@fixture.example");
        Assert.Equal("credentials_invalid", await Title(await client.PostAsJsonAsync("/api/auth/passkeys/registration/options",
            new BeginPasskeyRegistrationDto { CurrentPassword = Password })));
        await RegisterAsync(client, authenticator, TestAuthenticator.Code());

        using var fresh = Browser(factory);
        await Csrf(fresh);
        var ceremony = await Read<PasskeyCeremonyDto>(await fresh.PostAsync("/api/auth/login/passkey/options", null));
        var response = await fresh.PostAsJsonAsync("/api/auth/login/passkey", new { state = ceremony.State, credential = authenticator.Assert(ceremony.OptionsJson) });
        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await fresh.GetAsync("/api/auth/me")).StatusCode);
        await CompleteMfaAsync(fresh, (await Read<JsonElement>(response)).GetProperty("challenge"));
        var sessions = await Read<List<AccountSessionDto>>(await fresh.GetAsync("/api/auth/sessions"));
        Assert.Equal("mfa", Assert.Single(sessions, s => s.IsCurrent).AuthenticationMethod);
        var stored = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(f.Other))!;
        Assert.Equal(1u, Assert.Single(stored.Passkeys).SignCount);
        Assert.NotNull(stored.Passkeys[0].LastUsedAt);

        // A password-only (non-MFA) session of an MFA account cannot exist; a selected capacity is rejected.
        fresh.DefaultRequestHeaders.Add("X-ParishLife-Appointment", Guid.NewGuid().ToString("N"));
        Assert.NotEqual(HttpStatusCode.OK, (await fresh.GetAsync("/api/auth/passkeys")).StatusCode);
    }

    [Fact]
    public async Task Recovery_sessions_cannot_list_register_or_remove_passkeys()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.AsRecovery(f.Other);
        var service = f.Services.GetRequiredService<PasskeyService>();
        Assert.Equal("personal_security_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => service.ListAsync(default))).Code);
        Assert.Equal("personal_security_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => service.BeginRegistrationAsync(
            new BeginPasskeyRegistrationDto { CurrentPassword = Password, CurrentCode = TestAuthenticator.Code() }, default))).Code);
        Assert.Equal("personal_security_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => service.RemoveAsync("abc",
            new RemovePasskeyDto { OperationId = Guid.NewGuid(), CurrentPassword = Password, CurrentCode = TestAuthenticator.Code() }, default))).Code);
        f.As(f.Other);
        Assert.Empty(await service.ListAsync(default));
    }

    [Fact]
    public async Task Removal_requires_proof_signs_out_everywhere_and_releases_the_credential()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        var username = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(member))!.UserName!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = Browser(factory);
        using var other = Browser(factory);
        using var authenticator = new SoftwarePasskey();
        await LoginAsync(client, username);
        await LoginAsync(other, username);
        var passkey = await RegisterAsync(client, authenticator, null);
        var removal = new RemovePasskeyDto { OperationId = Guid.NewGuid(), CurrentPassword = "wrong-isolated-fixture-password" };
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/auth/passkeys/{passkey.Id}/remove", removal)).StatusCode);
        Assert.Single((await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(member))!.Passkeys);
        removal.CurrentPassword = Password;
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsJsonAsync("/api/auth/passkeys/unknown-credential/remove",
            new RemovePasskeyDto { OperationId = Guid.NewGuid(), CurrentPassword = Password })).StatusCode);
        var result = await Read<AccountSecurityChangeDto>(await client.PostAsJsonAsync($"/api/auth/passkeys/{passkey.Id}/remove", removal));
        Assert.Equal("Applied", result.Status);
        Assert.True(result.RequiresSignIn);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await other.GetAsync("/api/auth/me")).StatusCode);
        using var fresh = Browser(factory);
        await Csrf(fresh);
        var ceremony = await Read<PasskeyCeremonyDto>(await fresh.PostAsync("/api/auth/login/passkey/options", null));
        Assert.Equal(HttpStatusCode.Unauthorized, (await fresh.PostAsJsonAsync("/api/auth/login/passkey",
            new { state = ceremony.State, credential = authenticator.Assert(ceremony.OptionsJson) })).StatusCode);
        // The same authenticator can be registered again after its index is released; the removal replays as AlreadyApplied.
        // A second host over the same isolated directory avoids the per-host authentication rate limit.
        await using var next = new LocalApiFactory(f.DirectoryPath);
        using var again = Browser(next);
        await LoginAsync(again, username);
        Assert.Equal(authenticator.Id, (await RegisterAsync(again, authenticator, null)).Id);
        Assert.Equal("AlreadyApplied", (await Read<AccountSecurityChangeDto>(await again.PostAsJsonAsync($"/api/auth/passkeys/{passkey.Id}/remove", removal))).Status);
    }

    [Fact]
    public async Task A_concurrent_account_change_rolls_back_registration_and_releases_the_claimed_credential()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        f.As(member, false);
        var http = f.Services.GetRequiredService<IHttpContextAccessor>().HttpContext!;
        http.Request.Scheme = "https";
        http.Request.Host = new HostString("localhost");
        http.Request.Headers.Origin = SoftwarePasskey.Origin;
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var intercepted = new CommitInterceptionRecords(records, async () =>
        {
            var concurrent = (await users.FindByIdAsync(member))!;
            concurrent.DisplayName = "Independent concurrent update";
            Assert.True((await users.UpdateAsync(concurrent)).Succeeded);
        });
        var service = ActivatorUtilities.CreateInstance<PasskeyService>(f.Services, intercepted);
        using var authenticator = new SoftwarePasskey();
        var options = await service.BeginRegistrationAsync(new BeginPasskeyRegistrationDto { CurrentPassword = Password }, default);
        var request = new CompletePasskeyRegistrationDto { OperationId = Guid.NewGuid(), State = options.State, Credential = authenticator.Attest(options.OptionsJson) };
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.CompleteRegistrationAsync(request, default))).Code);
        Assert.Empty((await users.FindByIdAsync(member))!.Passkeys);
        Assert.Null(await records.ReadAsync<JsonElement>(MfaRecoveryService.Scope(member), "operation:" + request.OperationId.ToString("N"), default));
        // Retrying with the actual service succeeds because the credential index was released.
        var real = f.Services.GetRequiredService<PasskeyService>();
        Assert.Equal(authenticator.Id, (await real.CompleteRegistrationAsync(request, default)).Id);
    }

    private static HttpClient Browser(LocalApiFactory factory)
    {
        var client = factory.Client();
        client.DefaultRequestHeaders.Add("Origin", SoftwarePasskey.Origin);
        return client;
    }

    private static async Task<PasskeyDto> RegisterAsync(HttpClient client, SoftwarePasskey authenticator, string? code)
    {
        var options = await Read<PasskeyCeremonyDto>(await client.PostAsJsonAsync("/api/auth/passkeys/registration/options",
            new BeginPasskeyRegistrationDto { CurrentPassword = Password, CurrentCode = code }));
        return await Read<PasskeyDto>(await client.PostAsJsonAsync("/api/auth/passkeys/registration", new CompletePasskeyRegistrationDto
        { OperationId = Guid.NewGuid(), State = options.State, Credential = authenticator.Attest(options.OptionsJson), Name = "Laptop" }));
    }
}
