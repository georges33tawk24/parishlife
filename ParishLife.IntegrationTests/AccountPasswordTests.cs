// Purpose: verifies password changes through maintained Identity, actual transactions and authenticated HTTP.
// Main tests: fresh personal/MFA proofs, atomic credential/enrollment changes, non-secret retries, stale-write rollback,
// session/challenge invalidation, CSRF enforcement, sign-out and safe public contracts.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Accounts;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class AccountPasswordTests
{
    private const string Password = "isolated-fixture-long-password";
    private const string NewPassword = "replacement-isolated-long-password";

    [Fact]
    public async Task Member_change_supersedes_pending_enrollment_invalidates_sessions_and_keeps_metadata_secret_free()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        f.As(member, false);
        var users = f.Services.GetRequiredService<ParishUserManager>();
        var sessions = f.Services.GetRequiredService<AccountSessionService>();
        var original = (await users.FindByIdAsync(member))!;
        var oldStamp = original.SecurityStamp!;
        var oldSession = await sessions.CreateAsync(original, default);
        await f.Services.GetRequiredService<MfaSecurityService>().BeginAsync(new BeginMfaEnrollmentDto
        { OperationId = Guid.NewGuid(), CurrentPassword = Password }, default);
        var request = Request();
        var service = f.Services.GetRequiredService<AccountPasswordService>();
        var result = await service.ChangeAsync(request, default);
        Assert.Equal("Changed", result.Status);
        Assert.True(result.RequestedPasswordIsCurrent);
        Assert.True(result.PriorSessionsInvalidated);
        Assert.True(result.RequiresSignIn);
        var current = (await users.FindByIdAsync(member))!;
        Assert.NotEqual(oldStamp, current.SecurityStamp);
        Assert.True(await users.CheckPasswordAsync(current, NewPassword));
        Assert.False(await users.CheckPasswordAsync(current, Password));
        Assert.False(await sessions.ValidAsync(member, oldSession.Id, oldStamp, default));
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var enrollment = (await records.ReadAsync<MfaEnrollment>(MfaRecoveryService.Scope(member), "mfaEnrollment", default))!;
        Assert.Equal("Superseded", enrollment.Value.Status);
        Assert.Empty(enrollment.Value.ProtectedAuthenticatorKey);
        Assert.False(current.TwoFactorEnabled);
        var safe = JsonSerializer.Serialize(new
        {
            Receipt = await records.PageAsync<JsonElement>(MfaRecoveryService.Scope(member), "operation", 100, null, default),
            Audit = await records.PageAsync<JsonElement>(MfaRecoveryService.Scope(member), "audit", 100, null, default),
            result
        });
        foreach (var secret in new[] { Password, NewPassword, oldStamp, current.SecurityStamp!, current.PasswordHash! })
            Assert.DoesNotContain(secret, safe, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Retrying_a_committed_operation_reports_current_outcome_without_changing_the_password_again()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        f.As(member, false);
        var service = f.Services.GetRequiredService<AccountPasswordService>();
        var request = Request();
        var first = await service.ChangeAsync(request, default);
        request.CurrentPassword = NewPassword;
        var replay = await service.ChangeAsync(request, default);
        Assert.Equal("AlreadyApplied", replay.Status);
        Assert.True(replay.RequestedPasswordIsCurrent);
        Assert.Equal(first.ChangedAt, replay.ChangedAt);
        request.NewPassword = "different-isolated-proposed-password";
        var mismatchedRetry = await service.ChangeAsync(request, default);
        Assert.Equal("AlreadyApplied", mismatchedRetry.Status);
        Assert.False(mismatchedRetry.RequestedPasswordIsCurrent);
        var users = f.Services.GetRequiredService<ParishUserManager>();
        Assert.True(await users.CheckPasswordAsync((await users.FindByIdAsync(member))!, NewPassword));
        Assert.Single((await f.Services.GetRequiredService<IRecordTransactions>().PageAsync<JsonElement>(
            MfaRecoveryService.Scope(member), "operation", 100, null, default)).Items);
    }

    [Fact]
    public async Task Mfa_accounts_require_fresh_password_and_authenticator_and_cannot_use_recovery_or_staff_capacity()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var service = f.Services.GetRequiredService<AccountPasswordService>();
        f.As(f.Other, false);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => service.ChangeAsync(Request(), default))).Code);
        f.AsRecovery(f.Other);
        Assert.Equal("personal_password_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => service.ChangeAsync(Request(), default))).Code);
        f.AsAppointment(f.Other, Guid.NewGuid().ToString("N"));
        Assert.Equal("personal_password_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => service.ChangeAsync(Request(), default))).Code);
        f.As(f.Other);
        var invalid = Request();
        invalid.CurrentCode = "not-a-code";
        Assert.Equal("credentials_invalid", (await Assert.ThrowsAsync<DomainException>(() => service.ChangeAsync(invalid, default))).Code);
        var wrongPassword = Request();
        wrongPassword.CurrentPassword = "incorrect-isolated-password";
        wrongPassword.CurrentCode = TestAuthenticator.Code();
        Assert.Equal("credentials_invalid", (await Assert.ThrowsAsync<DomainException>(() => service.ChangeAsync(wrongPassword, default))).Code);
        Assert.Equal(2, (await f.Services.GetRequiredService<ParishUserManager>().FindByIdAsync(f.Other))!.AccessFailedCount);
        var request = Request();
        request.CurrentCode = TestAuthenticator.Code();
        Assert.True((await service.ChangeAsync(request, default)).RequestedPasswordIsCurrent);
        var users = f.Services.GetRequiredService<ParishUserManager>();
        Assert.True((await users.FindByIdAsync(f.Other))!.TwoFactorEnabled);
    }

    [Fact]
    public async Task Invalid_and_unchanged_passwords_do_not_replace_credentials_and_concurrent_writes_roll_back_the_change()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        f.As(member, false);
        var users = f.Services.GetRequiredService<ParishUserManager>();
        var service = f.Services.GetRequiredService<AccountPasswordService>();
        var original = (await users.FindByIdAsync(member))!;
        var tooShort = Request();
        tooShort.NewPassword = "short";
        Assert.Equal("invalid_password", (await Assert.ThrowsAsync<DomainException>(() => service.ChangeAsync(tooShort, default))).Code);
        var unchanged = Request();
        unchanged.NewPassword = Password;
        Assert.Equal("password_unchanged", (await Assert.ThrowsAsync<DomainException>(() => service.ChangeAsync(unchanged, default))).Code);
        Assert.Equal(original.SecurityStamp, (await users.FindByIdAsync(member))!.SecurityStamp);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var intercept = new CommitInterceptionRecords(records, async () =>
        {
            var concurrent = (await users.FindByIdAsync(member))!;
            concurrent.DisplayName = "Concurrent independent update";
            Assert.True((await users.UpdateAsync(concurrent)).Succeeded);
        });
        var concurrentService = ActivatorUtilities.CreateInstance<AccountPasswordService>(f.Services, intercept);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => concurrentService.ChangeAsync(Request(), default))).Code);
        var retained = (await users.FindByIdAsync(member))!;
        Assert.Equal("Concurrent independent update", retained.DisplayName);
        Assert.Equal(original.SecurityStamp, retained.SecurityStamp);
        Assert.True(await users.CheckPasswordAsync(retained, Password));
        Assert.False(await users.CheckPasswordAsync(retained, NewPassword));
        Assert.Empty((await records.PageAsync<JsonElement>(MfaRecoveryService.Scope(member), "operation", 100, null, default)).Items);
    }

    [Fact]
    public async Task Http_change_requires_csrf_signs_out_and_invalidates_other_cookies_and_old_mfa_challenges()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var first = factory.Client();
        using var other = factory.Client();
        using var pending = factory.Client();
        await Login(first, "other@fixture.example");
        await Login(other, "other@fixture.example");
        await Csrf(pending);
        var challenge = (await Read<JsonElement>(await pending.PostAsJsonAsync("/api/auth/login",
            new { username = "other@fixture.example", password = Password }))).GetProperty("challenge");
        var request = Request();
        request.CurrentCode = TestAuthenticator.Code();
        first.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await first.PostAsJsonAsync("/api/auth/password", request)).StatusCode);
        await Csrf(first);
        var result = await Read<PasswordChangeResultDto>(await first.PostAsJsonAsync("/api/auth/password", request));
        Assert.True(result.RequiresSignIn);
        Assert.Equal(HttpStatusCode.Unauthorized, (await first.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await other.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await pending.PostAsJsonAsync("/api/auth/login/mfa", new
        {
            accountId = challenge.GetProperty("accountId").GetString(),
            challenge = challenge.GetProperty("challenge").GetString(),
            code = TestAuthenticator.Code()
        })).StatusCode);
        Assert.Equal(f.Other, (await Login(first, "other@fixture.example", NewPassword)).Id);
        var schemas = (await Read<JsonElement>(await first.GetAsync("/openapi/v1.json"))).GetProperty("components").GetProperty("schemas");
        Assert.True(schemas.TryGetProperty("ChangeAccountPasswordDto", out _));
        Assert.True(schemas.TryGetProperty("PasswordChangeResultDto", out _));
        Assert.False(schemas.TryGetProperty("ParishUser", out _));
    }

    [Theory]
    [InlineData("unchanged")]
    [InlineData("invalid-authenticator")]
    [InlineData("concurrent-write")]
    public async Task Legacy_hash_proof_never_persists_a_rehash_or_stamp_before_the_complete_change(string rejection)
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.As(f.Other);
        var users = f.Services.GetRequiredService<ParishUserManager>();
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var scope = MfaRecoveryService.Scope(f.Other);
        await f.Services.GetRequiredService<MfaSecurityService>().BeginAsync(new BeginMfaEnrollmentDto
        { OperationId = Guid.NewGuid(), CurrentPassword = Password, CurrentCode = TestAuthenticator.Code() }, default);
        var user = (await users.FindByIdAsync(f.Other))!;
        var legacy = new PasswordHasher<ParishUser>(Options.Create(new PasswordHasherOptions { CompatibilityMode = PasswordHasherCompatibilityMode.IdentityV2 }));
        user.PasswordHash = legacy.HashPassword(user, Password);
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        user = (await users.FindByIdAsync(f.Other))!;
        Assert.Equal(PasswordVerificationResult.SuccessRehashNeeded, users.PasswordHasher.VerifyHashedPassword(user, user.PasswordHash!, Password));
        var sessions = f.Services.GetRequiredService<AccountSessionService>();
        var challenge = await sessions.CreateChallengeAsync(user, default);
        var session = await sessions.CreateAsync(user, default, await sessions.GetChallengeAsync(user.Id, challenge.Challenge, default));
        var original = (await users.FindByIdAsync(f.Other))!;
        var enrollment = (await records.ReadAsync<MfaEnrollment>(scope, "mfaEnrollment", default))!;
        var service = f.Services.GetRequiredService<AccountPasswordService>();
        if (rejection == "concurrent-write")
        {
            var intercepted = new CommitInterceptionRecords(records, async () =>
            {
                var concurrent = (await users.FindByIdAsync(f.Other))!;
                concurrent.DisplayName = "Independent legacy-account update";
                Assert.True((await users.UpdateAsync(concurrent)).Succeeded);
            });
            service = ActivatorUtilities.CreateInstance<AccountPasswordService>(f.Services, intercepted);
        }
        var request = Request();
        request.CurrentCode = TestAuthenticator.Code();
        if (rejection == "unchanged")
            request.NewPassword = Password;
        if (rejection == "invalid-authenticator")
            request.CurrentCode = "not-a-code";
        f.As(f.Other);
        var failure = await Assert.ThrowsAsync<DomainException>(() => service.ChangeAsync(request, default));
        Assert.Equal(rejection switch { "unchanged" => "password_unchanged", "invalid-authenticator" => "credentials_invalid", _ => "write_conflict" }, failure.Code);
        var retained = (await users.FindByIdAsync(f.Other))!;
        Assert.Equal(original.PasswordHash, retained.PasswordHash);
        Assert.Equal(original.SecurityStamp, retained.SecurityStamp);
        Assert.True(await sessions.ValidAsync(user.Id, session.Id, original.SecurityStamp!, default, "mfa"));
        var pending = (await records.ReadAsync<MfaEnrollment>(scope, "mfaEnrollment", default))!;
        Assert.Equal(enrollment.Version, pending.Version);
        Assert.Equal(enrollment.Value.ProtectedAuthenticatorKey, pending.Value.ProtectedAuthenticatorKey);
        Assert.Equal("Pending", pending.Value.Status);
        Assert.Null(await records.ReadAsync<JsonElement>(scope, "operation:" + request.OperationId.ToString("N"), default));
    }

    private static ChangeAccountPasswordDto Request() => new()
    { OperationId = Guid.NewGuid(), CurrentPassword = Password, NewPassword = NewPassword };

    private static async Task<AccountDto> Login(HttpClient client, string username, string password = Password)
    {
        await Csrf(client);
        var challenge = (await Read<JsonElement>(await client.PostAsJsonAsync("/api/auth/login", new { username, password }))).GetProperty("challenge");
        var account = await Read<AccountDto>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
        {
            accountId = challenge.GetProperty("accountId").GetString(),
            challenge = challenge.GetProperty("challenge").GetString(),
            code = TestAuthenticator.Code()
        }));
        await Csrf(client);
        return account;
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
