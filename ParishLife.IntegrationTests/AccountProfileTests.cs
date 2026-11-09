// Purpose: verifies personal profile/appearance against real Identity, isolated local transactions and authenticated HTTP.
// Main tests: own-account boundaries, coherent defaults, safe replay/reset, readable previews, stale atomic rollback, eligibility, CSRF and restricted recovery.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.Accounts.Profile;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Accounts;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class AccountProfileTests
{
    private const string Password = "isolated-fixture-long-password";

    [Fact]
    public async Task Member_profile_defaults_do_not_write_and_save_changes_only_personal_display_and_preferences()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        f.As(member, false);
        var users = f.Services.GetRequiredService<ParishUserManager>();
        var original = (await users.FindByIdAsync(member))!;
        var sessions = f.Services.GetRequiredService<AccountSessionService>();
        var session = await sessions.CreateAsync(original, default);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var service = Service(f);
        var before = await service.GetAsync(default);
        Assert.False(before.Value.IsConfigured);
        Assert.Null(before.Value.PreferredLanguage);
        Assert.Null(before.Value.UpdatedAt);
        Assert.Equal("forest", before.Value.Appearance.Scheme);
        Assert.Null(await records.ReadAsync<AccountProfile>(Scope(member), "accountProfile", default));
        Assert.Empty((await records.PageAsync<JsonElement>(Scope(member), "operation", 100, null, default)).Items);

        var request = Request(before.Version);
        var result = await service.UpdateAsync(request, default);
        Assert.Equal("Saved", result.Status);
        Assert.True(result.RequestedValuesAreCurrent);
        Assert.True(result.Current.Value.IsConfigured);
        Assert.Equal(request.DisplayName, result.Current.Value.DisplayName);
        Assert.Equal("ar", result.Current.Value.PreferredLanguage);
        Assert.Equal("#ABCDEF", result.Current.Value.Appearance.PrimaryColor);
        Assert.NotEqual(before.Version, result.Current.Version);
        var current = (await users.FindByIdAsync(member))!;
        Assert.Equal(original.UserName, current.UserName);
        Assert.Equal(original.NormalizedUserName, current.NormalizedUserName);
        Assert.Equal(original.Email, current.Email);
        Assert.Equal(original.NormalizedEmail, current.NormalizedEmail);
        Assert.Equal(original.EmailConfirmed, current.EmailConfirmed);
        Assert.Equal(original.PhoneNumber, current.PhoneNumber);
        Assert.Equal(original.IdentityVerified, current.IdentityVerified);
        Assert.Equal(original.ContactVerificationReference, current.ContactVerificationReference);
        Assert.Equal(original.PlatformOperator, current.PlatformOperator);
        Assert.Equal(original.TwoFactorEnabled, current.TwoFactorEnabled);
        Assert.Equal(original.PasswordHash, current.PasswordHash);
        Assert.Equal(original.SecurityStamp, current.SecurityStamp);
        Assert.True(await sessions.ValidAsync(member, session.Id, original.SecurityStamp!, default));
        Assert.Equal(member, (await users.FindByNameAsync(original.UserName!))!.Id);
        var metadata = JsonSerializer.Serialize(new
        {
            Receipts = await records.PageAsync<JsonElement>(Scope(member), "operation", 100, null, default),
            Audit = await records.PageAsync<JsonElement>(Scope(member), "audit", 100, null, default)
        });
        Assert.DoesNotContain(request.DisplayName, metadata);
        Assert.DoesNotContain("PrivateProfile-", metadata);
        Assert.DoesNotContain("DisplayName", metadata, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("#ABCDEF", metadata);
        foreach (var secret in new[] { Password, current.SecurityStamp!, current.PasswordHash! })
            Assert.DoesNotContain(secret, metadata);
        var safe = JsonSerializer.Serialize(result.Current.Value);
        Assert.DoesNotContain(current.Email!, safe);
        Assert.DoesNotContain("SecurityStamp", safe);
        Assert.DoesNotContain("PasswordHash", safe);
        f.As(f.Other);
        Assert.DoesNotContain("PrivateProfile-", JsonSerializer.Serialize(await service.GetAsync(default)));
    }

    [Fact]
    public async Task Retry_reports_original_application_and_current_state_without_overwriting_a_newer_change()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.As(f.Other);
        var service = Service(f);
        var request = Request((await service.GetAsync(default)).Version);
        var first = await service.UpdateAsync(request, default);
        var second = Request(first.Current.Version);
        second.DisplayName = "Later personal display";
        second.PreferredLanguage = "fr";
        second.Appearance = new AccountAppearanceDto { Scheme = "navy", Mode = "light" };
        await service.UpdateAsync(second, default);
        var retry = await service.UpdateAsync(request, default);
        Assert.Equal("AlreadyApplied", retry.Status);
        Assert.Equal(first.AppliedAt, retry.AppliedAt);
        Assert.False(retry.RequestedValuesAreCurrent);
        Assert.Equal(second.DisplayName, retry.Current.Value.DisplayName);
        Assert.Equal("fr", retry.Current.Value.PreferredLanguage);
        request.DisplayName = "Different intent with reused operation";
        Assert.Equal("operation_reused", (await Assert.ThrowsAsync<DomainException>(() => service.UpdateAsync(request, default))).Code);
        Assert.Equal(2, (await f.Services.GetRequiredService<IRecordTransactions>().PageAsync<JsonElement>(Scope(f.Other), "operation", 100, null, default)).Items.Count);
        var reset = new ResetAccountAppearanceDto { OperationId = Guid.NewGuid(), Version = retry.Current.Version };
        var restored = await service.ResetAppearanceAsync(reset, default);
        Assert.Equal(second.DisplayName, restored.Current.Value.DisplayName);
        Assert.Equal("fr", restored.Current.Value.PreferredLanguage);
        Assert.Equal("forest", restored.Current.Value.Appearance.Scheme);
        Assert.Equal("light", restored.Current.Value.Appearance.Mode);
        Assert.Equal("#233B32", restored.Current.Value.Appearance.PrimaryColor);
        Assert.Equal("AlreadyApplied", (await service.ResetAppearanceAsync(reset, default)).Status);
    }

    [Fact]
    public async Task Concurrent_duplicate_save_has_one_receipt_and_preview_is_validated_readable_and_never_persisted()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.As(f.Other);
        var service = Service(f);
        foreach (var mode in new[] { "light", "dark" })
            foreach (var color in new[] { "#FFFFFF", "#000000", "#FFFF00", "#FF0000", "#00FF00", "#0000FF", "#ABCDEF", "#777777" })
            {
                var preview = await service.PreviewAsync(new AccountAppearanceDto { Scheme = "custom", PrimaryColor = color, Mode = mode }, default);
                Assert.False(preview.Saved);
                Assert.False(preview.OverridesSemanticStatusColors);
                Assert.Equal(color, preview.Appearance.PrimaryColor);
                Assert.True(preview.PrimaryTextContrast >= 4.5);
                Assert.True(preview.LinkContrast >= 4.5);
                Assert.Contains(preview.PrimaryForeground, new[] { "#FFFFFF", "#000000" });
                Assert.Equal(preview.SurfaceForeground, preview.FocusColor);
                Assert.Equal(preview.SurfaceForeground, preview.PrimaryOutlineColor);
            }
        var white = await service.PreviewAsync(new AccountAppearanceDto { Scheme = "custom", PrimaryColor = "#FFFFFF" }, default);
        Assert.Equal("#000000", white.PrimaryForeground);
        Assert.Equal(21d, white.PrimaryTextContrast, 6);
        var black = await service.PreviewAsync(new AccountAppearanceDto { Scheme = "custom", PrimaryColor = "#000000" }, default);
        Assert.Equal("#FFFFFF", black.PrimaryForeground);
        Assert.Equal(21d, black.PrimaryTextContrast, 6);
        Assert.Equal(21d, black.LinkContrast, 6);
        foreach (var invalid in new[]
        {
            new AccountAppearanceDto { Scheme = "custom", PrimaryColor = "var(--danger)" },
            new AccountAppearanceDto { Scheme = "custom", PrimaryColor = "#abc" },
            new AccountAppearanceDto { Scheme = "custom" },
            new AccountAppearanceDto { Scheme = "forest", PrimaryColor = "#FFFFFF" },
            new AccountAppearanceDto { Scheme = "unapproved" },
            new AccountAppearanceDto { Mode = "automatic" }
        })
            Assert.Equal("invalid_appearance", (await Assert.ThrowsAsync<DomainException>(() => service.PreviewAsync(invalid, default))).Code);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        Assert.Null(await records.ReadAsync<AccountProfile>(Scope(f.Other), "accountProfile", default));
        Assert.Empty((await records.PageAsync<JsonElement>(Scope(f.Other), "operation", 100, null, default)).Items);
        var request = Request((await service.GetAsync(default)).Version);
        var outcomes = await Task.WhenAll(service.UpdateAsync(request, default), service.UpdateAsync(request, default));
        Assert.All(outcomes, outcome => Assert.True(outcome.RequestedValuesAreCurrent));
        Assert.Single((await records.PageAsync<JsonElement>(Scope(f.Other), "operation", 100, null, default)).Items);
    }

    [Fact]
    public async Task Stale_versions_and_mid_commit_revocation_preserve_both_identity_and_preferences_without_a_receipt()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.As(f.Other);
        var service = Service(f);
        var request = Request((await service.GetAsync(default)).Version);
        var first = await service.UpdateAsync(request, default);
        var stale = Request(request.Version);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.UpdateAsync(stale, default))).Code);
        var invalid = Request(first.Current.Version);
        invalid.PreferredLanguage = "guessed-language";
        Assert.Equal("invalid_profile", (await Assert.ThrowsAsync<DomainException>(() => service.UpdateAsync(invalid, default))).Code);
        invalid.PreferredLanguage = "en";
        invalid.DisplayName = "One\nTwo";
        Assert.Equal("invalid_profile", (await Assert.ThrowsAsync<DomainException>(() => service.UpdateAsync(invalid, default))).Code);
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var users = f.Services.GetRequiredService<ParishUserManager>();
        var intercept = new CommitInterceptionRecords(records, async () =>
        {
            var concurrent = (await users.FindByIdAsync(f.Other))!;
            concurrent.Active = false;
            Assert.True((await users.UpdateAsync(concurrent)).Succeeded);
        });
        var raced = ActivatorUtilities.CreateInstance<AccountProfileService>(f.Services, intercept);
        var attempted = Request(first.Current.Version);
        attempted.DisplayName = "Uncommitted display";
        attempted.PreferredLanguage = "en";
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => raced.UpdateAsync(attempted, default))).Code);
        var retained = (await users.FindByIdAsync(f.Other))!;
        Assert.False(retained.Active);
        Assert.Equal(request.DisplayName, retained.DisplayName);
        Assert.Equal("ar", (await records.ReadAsync<AccountProfile>(Scope(f.Other), "accountProfile", default))!.Value.PreferredLanguage);
        Assert.Null(await records.ReadAsync<JsonElement>(Scope(f.Other), "operation:" + attempted.OperationId.ToString("N"), default));
        Assert.Equal("account_unavailable", (await Assert.ThrowsAsync<DomainException>(() => service.UpdateAsync(request, default))).Code);
    }

    [Fact]
    public async Task Personal_capacity_normal_authentication_current_verification_and_lockout_are_enforced_for_reads_and_retries()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var service = Service(f);
        f.As(f.Other, false);
        Assert.Equal("mfa_required", (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(default))).Code);
        f.AsRecovery(f.Other);
        Assert.Equal("personal_profile_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(default))).Code);
        f.AsAppointment(f.Other, Guid.NewGuid().ToString("N"));
        Assert.Equal("personal_profile_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(default))).Code);
        f.As(f.Other);
        var request = Request((await service.GetAsync(default)).Version);
        await service.UpdateAsync(request, default);
        var users = f.Services.GetRequiredService<ParishUserManager>();
        var user = (await users.FindByIdAsync(f.Other))!;
        user.LockoutEnd = DateTimeOffset.MaxValue;
        user.LockoutEnabled = true;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        Assert.Equal("account_unavailable", (await Assert.ThrowsAsync<DomainException>(() => service.UpdateAsync(request, default))).Code);
        user = (await users.FindByIdAsync(f.Other))!;
        user.LockoutEnd = null;
        user.IdentityVerified = false;
        user.EmailConfirmed = false;
        user.PhoneNumberConfirmed = false;
        Assert.True((await users.UpdateAsync(user)).Succeeded);
        Assert.Equal("account_unavailable", (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(default))).Code);
    }

    [Fact]
    public async Task Http_profile_requires_csrf_rejects_overposting_is_private_and_keeps_normal_sign_in_after_display_save()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        using var second = factory.Client();
        using var anonymous = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/auth/profile")).StatusCode);
        await Login(client, "other@fixture.example");
        await Login(second, "nominee@fixture.example");
        var before = await Read<Versioned<AccountProfileDto>>(await client.GetAsync("/api/auth/profile"));
        var request = Request(before.Version);
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/auth/profile", request)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/profile/appearance/preview", request.Appearance)).StatusCode);
        await Csrf(client);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/auth/profile", new
        {
            request.OperationId,
            request.Version,
            request.DisplayName,
            request.PreferredLanguage,
            request.Appearance,
            email = "forbidden-change@fixture.example",
            platformOperator = true,
            accountId = f.Nominee
        })).StatusCode);
        var result = await Read<AccountProfileResultDto>(await client.PutAsJsonAsync("/api/auth/profile", request));
        Assert.True(result.RequestedValuesAreCurrent);
        Assert.Equal(request.DisplayName, (await Read<AccountDto>(await client.GetAsync("/api/auth/me"))).DisplayName);
        var other = await Read<Versioned<AccountProfileDto>>(await second.GetAsync("/api/auth/profile"));
        Assert.False(other.Value.IsConfigured);
        Assert.NotEqual(request.DisplayName, other.Value.DisplayName);
        client.DefaultRequestHeaders.Add("X-ParishLife-Appointment", Guid.NewGuid().ToString("N"));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/auth/profile")).StatusCode);
        client.DefaultRequestHeaders.Remove("X-ParishLife-Appointment");
        var reset = await Read<AccountProfileResultDto>(await client.PostAsJsonAsync("/api/auth/profile/appearance/reset",
            new ResetAccountAppearanceDto { OperationId = Guid.NewGuid(), Version = result.Current.Version }));
        Assert.Equal(request.DisplayName, reset.Current.Value.DisplayName);
        Assert.Equal(request.PreferredLanguage, reset.Current.Value.PreferredLanguage);
        var response = await client.GetAsync("/api/auth/profile");
        Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
    }

    [Fact]
    public async Task Actual_recovery_cookie_cannot_read_update_preview_or_reset_personal_profile()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.As(f.Other);
        var codes = await f.Services.GetRequiredService<MfaSecurityService>().RegenerateAsync(new RegenerateRecoveryCodesDto
        { OperationId = Guid.NewGuid(), CurrentPassword = Password, CurrentCode = TestAuthenticator.Code() }, default);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await Csrf(client);
        var challenge = (await Read<JsonElement>(await client.PostAsJsonAsync("/api/auth/login",
            new { username = "other@fixture.example", password = Password }))).GetProperty("challenge");
        await Read<RecoverySignInDto>(await client.PostAsJsonAsync("/api/auth/login/mfa/recovery", new CompleteRecoveryLoginDto
        {
            AccountId = Guid.Parse(f.Other),
            Challenge = challenge.GetProperty("challenge").GetString()!,
            RecoveryCode = codes.RecoveryCodes[0]
        }));
        await Csrf(client);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/auth/profile")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync("/api/auth/profile", Request("not-used"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/auth/profile/appearance/preview", new AccountAppearanceDto())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/auth/profile/appearance/reset",
            new ResetAccountAppearanceDto { OperationId = Guid.NewGuid(), Version = "not-used" })).StatusCode);
    }

    private static AccountProfileService Service(LocalBackendFixture fixture) => ActivatorUtilities.CreateInstance<AccountProfileService>(fixture.Services);

    private static RecordScope Scope(string account) => new() { Area = ParishLife.Api.Models.Enums.RecordArea.Account, OwnerId = account };

    private static UpdateAccountProfileDto Request(string version) => new()
    {
        OperationId = Guid.NewGuid(),
        Version = version,
        DisplayName = "PrivateProfile-اسم عرض شخصي Élodie",
        PreferredLanguage = "ar",
        Appearance = new AccountAppearanceDto { Scheme = "custom", Mode = "dark", PrimaryColor = "#abcdef" }
    };

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
