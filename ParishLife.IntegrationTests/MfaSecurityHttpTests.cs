// Purpose: verifies MFA enrollment and reviewed lost-device recovery through actual HTTP, cookies, CSRF, and Identity checks.
// Main tests: Enrollment_and_recovery_login_keep_recovery_cookies_out_of_regular_work and
// A_second_admin_reviews_the_lost_device_before_the_owner_can_restore_operator_access.
// Helpers: PasswordLoginAsync, AuthenticatorLoginAsync, CsrfAsync, and ReadAsync exercise the real protocol without frontend integration.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Models;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MfaSecurityHttpTests
{
    private const string Password = "isolated-fixture-long-password";

    [Fact]
    public async Task Enrollment_and_recovery_login_keep_recovery_cookies_out_of_regular_work()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var member = await fixture.CreateVerifiedMemberAsync();
        var user = (await fixture.Services.GetRequiredService<ParishUserManager>().FindByIdAsync(member))!;
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var client = factory.Client();
        await CsrfAsync(client);
        var initial = await client.PostAsJsonAsync("/api/auth/login", new { username = user.UserName, password = Password });
        Assert.Equal(HttpStatusCode.OK, initial.StatusCode);
        await CsrfAsync(client);
        Assert.False((await ReadAsync<MfaSecurityStatusDto>(await client.GetAsync("/api/auth/mfa/status"))).Enabled);
        var setup = await ReadAsync<MfaEnrollmentDto>(await client.PostAsJsonAsync("/api/auth/mfa/enrollment", new BeginMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password
        }));
        Assert.StartsWith("otpauth://totp/ParishLife:", setup.AuthenticatorUri, StringComparison.Ordinal);
        var completedResponse = await client.PostAsJsonAsync("/api/auth/mfa/enrollment/complete", new CompleteMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            EnrollmentId = Guid.Parse(setup.EnrollmentId),
            CurrentPassword = Password,
            Code = TestAuthenticator.Code(setup.SharedKey)
        });
        Assert.Contains("no-store", completedResponse.Headers.CacheControl!.ToString());
        var codes = await ReadAsync<MfaRecoveryCodesDto>(completedResponse);
        Assert.True(codes.Enabled);
        Assert.True(codes.RequiresSignIn);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);

        var challenge = await PasswordLoginAsync(client, user.UserName!);
        var recovery = new CompleteRecoveryLoginDto { AccountId = Guid.Parse(member), Challenge = challenge, RecoveryCode = codes.RecoveryCodes[0] };
        var restored = await ReadAsync<RecoverySignInDto>(await client.PostAsJsonAsync("/api/auth/login/mfa/recovery", recovery));
        Assert.Equal("recovery", restored.AuthenticationMethod);
        await CsrfAsync(client);
        var status = await ReadAsync<MfaSecurityStatusDto>(await client.GetAsync("/api/auth/mfa/status"));
        Assert.True(status.RecoverySession);
        Assert.Equal(codes.RecoveryCodes.Length - 1, status.RecoveryCodesRemaining);
        var blocked = await client.GetAsync("/api/parishes/11111111-1111-1111-1111-111111111111");
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Equal("recovery_session_restricted", (await blocked.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/auth/password", new
        {
            currentPassword = Password,
            newPassword = "another-isolated-private-password"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login/mfa/recovery", recovery)).StatusCode);
        var sessions = await ReadAsync<AccountSessionDto[]>(await client.GetAsync("/api/auth/sessions"));
        Assert.Contains(sessions, value => value.Status == "Invalidated" && value.AuthenticationMethod == "pwd");
        Assert.Contains(sessions, value => value.IsCurrent && value.Status == "Active" && value.AuthenticationMethod == "recovery");
        await using var inspection = factory.Services.CreateAsyncScope();
        var account = (await inspection.ServiceProvider.GetRequiredService<IUserStore<ParishUser>>().FindByIdAsync(member, default))!;
        Assert.False(account.PlatformOperator);
        Assert.False(account.EmailConfirmed);
    }

    [Fact]
    public async Task A_second_admin_reviews_the_lost_device_before_the_owner_can_restore_operator_access()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var owner = factory.Client();
        using var reviewer = factory.Client();
        await AuthenticatorLoginAsync(owner, "colinsleiman", TestAuthenticator.InitialSecret);
        var codes = await ReadAsync<MfaRecoveryCodesDto>(await owner.PostAsJsonAsync("/api/auth/mfa/recovery-codes", new RegenerateRecoveryCodesDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code()
        }));
        var challenge = await PasswordLoginAsync(owner, "colinsleiman");
        await ReadAsync<RecoverySignInDto>(await owner.PostAsJsonAsync("/api/auth/login/mfa/recovery", new CompleteRecoveryLoginDto
        {
            AccountId = Guid.Parse(fixture.FirstAdmin),
            Challenge = challenge,
            RecoveryCode = codes.RecoveryCodes[0]
        }));
        await CsrfAsync(owner);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.GetAsync("/api/administration/readiness")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.GetAsync("/api/auth/staff-appointments")).StatusCode);
        var request = await ReadAsync<MfaRecoveryRequestDto>(await owner.PostAsJsonAsync("/api/auth/mfa/recovery-requests", new RequestMfaRecoveryDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            Reason = "Isolated HTTP lost-device review"
        }));
        await AuthenticatorLoginAsync(reviewer, "georgestawk", TestAuthenticator.InitialSecret);
        var reviewPath = $"/api/administration/accounts/{fixture.FirstAdmin}/mfa-recovery-requests/{request.Id}";
        var pending = await ReadAsync<Versioned<MfaRecoveryRequestDto>>(await reviewer.GetAsync(reviewPath));
        var approved = await ReadAsync<MfaRecoveryRequestDto>(await reviewer.PostAsJsonAsync(reviewPath + "/review", new ReviewMfaRecoveryDto
        {
            OperationId = Guid.NewGuid(),
            Version = pending.Version,
            Approve = true,
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code(),
            Reason = "Independent HTTP identity review",
            VerificationReference = "Isolated HTTP identity review evidence"
        }));
        Assert.Equal("Approved", approved.Status);
        var setup = await ReadAsync<MfaEnrollmentDto>(await owner.PostAsJsonAsync("/api/auth/mfa/enrollment", new BeginMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            RecoveryRequestId = Guid.Parse(request.Id)
        }));
        var result = await ReadAsync<MfaRecoveryCodesDto>(await owner.PostAsJsonAsync("/api/auth/mfa/enrollment/complete", new CompleteMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            EnrollmentId = Guid.Parse(setup.EnrollmentId),
            CurrentPassword = Password,
            Code = TestAuthenticator.Code(setup.SharedKey)
        }));
        Assert.True(result.RequiresSignIn);
        await AuthenticatorLoginAsync(owner, "colinsleiman", setup.SharedKey);
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync("/api/administration/readiness")).StatusCode);
        var consumed = await ReadAsync<Versioned<MfaRecoveryRequestDto>>(await reviewer.GetAsync(reviewPath));
        Assert.Equal("Consumed", consumed.Value.Status);
        var openApi = await ReadAsync<JsonElement>(await owner.GetAsync("/openapi/v1.json"));
        var schemas = openApi.GetProperty("components").GetProperty("schemas");
        Assert.True(schemas.GetProperty("MfaEnrollmentDto").GetProperty("properties").TryGetProperty("sharedKey", out _));
        Assert.True(schemas.GetProperty("MfaRecoveryCodesDto").GetProperty("properties").TryGetProperty("recoveryCodes", out _));
        Assert.False(schemas.TryGetProperty("ParishUser", out _));
    }

    private static async Task<string> PasswordLoginAsync(HttpClient client, string username)
    {
        await CsrfAsync(client);
        var pending = await client.PostAsJsonAsync("/api/auth/login", new { username, password = Password });
        Assert.Equal(HttpStatusCode.Accepted, pending.StatusCode);
        var value = await ReadAsync<JsonElement>(pending);
        return value.GetProperty("challenge").GetProperty("challenge").GetString()!;
    }

    private static async Task AuthenticatorLoginAsync(HttpClient client, string username, string secret)
    {
        await CsrfAsync(client);
        var pending = await ReadAsync<JsonElement>(await client.PostAsJsonAsync("/api/auth/login", new { username, password = Password }));
        var challenge = pending.GetProperty("challenge");
        await ReadAsync<AccountDto>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
        {
            accountId = challenge.GetProperty("accountId").GetString(),
            challenge = challenge.GetProperty("challenge").GetString(),
            code = TestAuthenticator.Code(secret)
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
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
}
