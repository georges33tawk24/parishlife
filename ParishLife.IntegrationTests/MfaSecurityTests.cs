// Purpose: verifies staged MFA, secret protection, single-use recovery and reviewed reset using real isolated Identity/document implementations.
// Main tests: initial enrollment and invalidation, duplicate concurrency, failed-proof preservation, code redemption races,
// independent reviewed reset, expired/rejected/stale/revoked approval denial, and cross-account protection.

using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MfaSecurityTests
{
    private const string Password = "isolated-fixture-long-password";

    [Fact]
    public async Task Legacy_sessions_without_a_recorded_authentication_method_require_fresh_login_and_are_reported_honestly()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var users = fixture.Services.GetRequiredService<ParishUserManager>();
        var account = (await users.FindByIdAsync(fixture.Nominee))!;
        var id = Guid.NewGuid().ToString("N");
        var records = fixture.Services.GetRequiredService<IRecordTransactions>();
        var scope = new RecordScope { Area = RecordArea.Account, OwnerId = account.Id };
        await records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), account.Id, new { Kind = "fixture.legacy-session" }, fixture.Clock),
            "fixture.legacy_session", id,
            [RecordChange.Create("session:" + id, "session", new
            {
                Id = id, AccountId = account.Id, SecurityStamp = account.SecurityStamp!, CreatedAt = fixture.Clock.Now,
                ExpiresAt = fixture.Clock.Now.AddHours(1), Revoked = false
            })], new CommandResult { Id = id, Status = "Fixture" }, default);
        var stored = (await records.ReadAsync<AccountSession>(scope, "session:" + id, default))!;
        Assert.Equal("legacy", stored.Value.AuthenticationMethod);
        var sessions = fixture.Services.GetRequiredService<AccountSessionService>();
        Assert.False(await sessions.ValidAsync(account.Id, id, account.SecurityStamp!, default, "mfa"));
        Assert.False(await sessions.ValidAsync(account.Id, id, account.SecurityStamp!, default, "pwd"));
        var view = AccountSessionDto.From(stored.Value, account.SecurityStamp, null, fixture.Clock.Now);
        Assert.Equal("unknown", view.AuthenticationMethod);
        Assert.Equal("Invalidated", view.Status);
    }

    [Fact]
    public async Task An_existing_device_can_be_rotated_with_fresh_old_and_new_authenticator_proofs()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        fixture.As(fixture.Nominee);
        var security = fixture.Services.GetRequiredService<MfaSecurityService>();
        var setup = await security.BeginAsync(new BeginMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code()
        }, default);
        var codes = await security.CompleteAsync(new CompleteMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            EnrollmentId = Guid.Parse(setup.EnrollmentId),
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code(),
            Code = TestAuthenticator.Code(setup.SharedKey)
        }, default);
        var users = fixture.Services.GetRequiredService<ParishUserManager>();
        var stored = (await users.FindByIdAsync(fixture.Nominee))!;
        Assert.Equal(setup.SharedKey, await users.GetAuthenticatorKeyAsync(stored));
        Assert.Equal(codes.RecoveryCodes.Length, await users.CountRecoveryCodesAsync(stored));
        Assert.True(stored.TwoFactorEnabled);
        Assert.False(stored.PlatformOperator);
    }

    [Fact]
    public async Task Code_replacement_invalidates_previous_codes_and_challenges_and_expired_challenges_consume_nothing()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        fixture.As(fixture.Nominee);
        var security = fixture.Services.GetRequiredService<MfaSecurityService>();
        var users = fixture.Services.GetRequiredService<ParishUserManager>();
        var sessions = fixture.Services.GetRequiredService<AccountSessionService>();
        var first = await security.RegenerateAsync(new RegenerateRecoveryCodesDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code()
        }, default);
        var oldChallenge = await sessions.CreateChallengeAsync((await users.FindByIdAsync(fixture.Nominee))!, default);
        var second = await security.RegenerateAsync(new RegenerateRecoveryCodesDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code()
        }, default);
        Assert.Null(await security.RecoverLoginAsync(new CompleteRecoveryLoginDto
        {
            AccountId = Guid.Parse(fixture.Nominee),
            Challenge = oldChallenge.Challenge,
            RecoveryCode = second.RecoveryCodes[0]
        }, default));
        var current = await sessions.CreateChallengeAsync((await users.FindByIdAsync(fixture.Nominee))!, default);
        Assert.Null(await security.RecoverLoginAsync(new CompleteRecoveryLoginDto
        {
            AccountId = Guid.Parse(fixture.Nominee),
            Challenge = current.Challenge,
            RecoveryCode = first.RecoveryCodes[0]
        }, default));
        fixture.Clock.Now = fixture.Clock.Now.AddMinutes(6);
        Assert.Null(await security.RecoverLoginAsync(new CompleteRecoveryLoginDto
        {
            AccountId = Guid.Parse(fixture.Nominee),
            Challenge = current.Challenge,
            RecoveryCode = second.RecoveryCodes[0]
        }, default));
        Assert.Equal(second.RecoveryCodes.Length, await users.CountRecoveryCodesAsync((await users.FindByIdAsync(fixture.Nominee))!));
        Assert.Empty(await sessions.ListAsync(fixture.Nominee, default));
    }

    [Fact]
    public async Task Enrollment_proves_the_new_device_before_enabling_and_revokes_previous_sessions_without_storing_plain_secrets()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var member = await fixture.CreateVerifiedMemberAsync();
        fixture.As(member, mfa: false);
        var users = fixture.Services.GetRequiredService<ParishUserManager>();
        var sessions = fixture.Services.GetRequiredService<AccountSessionService>();
        var original = (await users.FindByIdAsync(member))!;
        var oldSession = await sessions.CreateAsync(original, default);
        var service = fixture.Services.GetRequiredService<MfaSecurityService>();
        var begin = new BeginMfaEnrollmentDto { OperationId = Guid.NewGuid(), CurrentPassword = Password };
        var setup = await service.BeginAsync(begin, default);
        Assert.Equal(setup.SharedKey, (await service.BeginAsync(begin, default)).SharedKey);
        Assert.False((await users.FindByIdAsync(member))!.TwoFactorEnabled);
        Assert.True(await sessions.ValidAsync(member, oldSession.Id, oldSession.SecurityStamp, default));
        var result = await service.CompleteAsync(new CompleteMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            EnrollmentId = Guid.Parse(setup.EnrollmentId),
            CurrentPassword = Password,
            Code = TestAuthenticator.Code(setup.SharedKey)
        }, default);
        var saved = (await users.FindByIdAsync(member))!;
        Assert.True(saved.TwoFactorEnabled);
        Assert.False(saved.PlatformOperator);
        Assert.False(saved.EmailConfirmed);
        Assert.True(result.RequiresSignIn);
        Assert.NotEmpty(result.RecoveryCodes);
        Assert.Equal(result.RecoveryCodes.Length, await users.CountRecoveryCodesAsync(saved));
        Assert.False(await sessions.ValidAsync(member, oldSession.Id, oldSession.SecurityStamp, default));
        Assert.True(await users.VerifyTwoFactorTokenAsync(saved, TokenOptions.DefaultAuthenticatorProvider, TestAuthenticator.Code(setup.SharedKey)));
        foreach (var path in Directory.EnumerateFiles(fixture.DirectoryPath, "*.json", SearchOption.AllDirectories))
        {
            var persisted = await File.ReadAllTextAsync(path);
            Assert.DoesNotContain(Password, persisted, StringComparison.Ordinal);
            Assert.DoesNotContain(setup.SharedKey, persisted, StringComparison.Ordinal);
            foreach (var code in result.RecoveryCodes)
                Assert.DoesNotContain(code, persisted, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task Duplicate_start_and_completion_races_return_only_committed_keys_and_codes()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var member = await fixture.CreateVerifiedMemberAsync();
        fixture.As(member, mfa: false);
        var service = fixture.Services.GetRequiredService<MfaSecurityService>();
        var begin = new BeginMfaEnrollmentDto { OperationId = Guid.NewGuid(), CurrentPassword = Password };
        var setups = await Task.WhenAll(service.BeginAsync(begin, default), service.BeginAsync(begin, default));
        Assert.Equal(setups[0].SharedKey, setups[1].SharedKey);
        var request = new CompleteMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            EnrollmentId = Guid.Parse(setups[0].EnrollmentId),
            CurrentPassword = Password,
            Code = TestAuthenticator.Code(setups[0].SharedKey)
        };
        async Task<MfaRecoveryCodesDto?> Complete()
        {
            try
            { return await service.CompleteAsync(request, default); }
            catch (DomainException error) when (error.Kind == FailureKind.Conflict) { return null; }
        }
        var outcomes = await Task.WhenAll(Complete(), Complete());
        var winner = Assert.Single(outcomes, value => value is not null)!;
        var store = (IUserTwoFactorRecoveryCodeStore<ParishUser>)fixture.Services.GetRequiredService<IUserStore<ParishUser>>();
        var users = fixture.Services.GetRequiredService<ParishUserManager>();
        foreach (var code in winner.RecoveryCodes)
        {
            var freshSnapshot = (await users.FindByIdAsync(member))!;
            Assert.True(await store.RedeemCodeAsync(freshSnapshot, code, default));
        }
        Assert.Equal(winner.RecoveryCodes.Length, await users.CountRecoveryCodesAsync((await users.FindByIdAsync(member))!));
    }

    [Fact]
    public async Task Failed_new_device_proof_and_expired_setup_preserve_the_active_authenticator()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        fixture.As(fixture.Nominee);
        var users = fixture.Services.GetRequiredService<ParishUserManager>();
        var previous = (await users.FindByIdAsync(fixture.Nominee))!;
        var service = fixture.Services.GetRequiredService<MfaSecurityService>();
        var setup = await service.BeginAsync(new BeginMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code()
        }, default);
        await Assert.ThrowsAsync<DomainException>(() => service.CompleteAsync(new CompleteMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            EnrollmentId = Guid.Parse(setup.EnrollmentId),
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code(),
            Code = "nototp"
        }, default));
        var afterFailure = (await users.FindByIdAsync(fixture.Nominee))!;
        Assert.Equal(previous.AuthenticatorKey, afterFailure.AuthenticatorKey);
        Assert.Equal(previous.SecurityStamp, afterFailure.SecurityStamp);
        Assert.True(afterFailure.TwoFactorEnabled);
        fixture.Clock.Now = fixture.Clock.Now.AddMinutes(11);
        await Assert.ThrowsAsync<DomainException>(() => service.CompleteAsync(new CompleteMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            EnrollmentId = Guid.Parse(setup.EnrollmentId),
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code(),
            Code = TestAuthenticator.Code(setup.SharedKey)
        }, default));
        Assert.Equal(previous.AuthenticatorKey, (await users.FindByIdAsync(fixture.Nominee))!.AuthenticatorKey);
    }

    [Fact]
    public async Task Recovery_redemption_races_consume_one_code_and_issue_one_restricted_session()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        fixture.As(fixture.Nominee);
        var service = fixture.Services.GetRequiredService<MfaSecurityService>();
        var codes = await service.RegenerateAsync(new RegenerateRecoveryCodesDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code()
        }, default);
        var users = fixture.Services.GetRequiredService<ParishUserManager>();
        var sessions = fixture.Services.GetRequiredService<AccountSessionService>();
        var saved = (await users.FindByIdAsync(fixture.Nominee))!;
        var first = await sessions.CreateChallengeAsync(saved, default);
        var second = await sessions.CreateChallengeAsync(saved, default);
        var outcomes = await Task.WhenAll(new[] { first, second }.Select(challenge => service.RecoverLoginAsync(new CompleteRecoveryLoginDto
        {
            AccountId = Guid.Parse(saved.Id),
            Challenge = challenge.Challenge,
            RecoveryCode = codes.RecoveryCodes[0]
        }, default)));
        var winner = Assert.Single(outcomes, value => value is not null)!.Value;
        Assert.Equal("recovery", winner.Session.AuthenticationMethod);
        Assert.Equal(TimeSpan.FromMinutes(15), winner.Session.ExpiresAt - winner.Session.CreatedAt);
        Assert.Single(await sessions.ListAsync(saved.Id, default));
        Assert.Equal(codes.RecoveryCodes.Length - 1, await users.CountRecoveryCodesAsync((await users.FindByIdAsync(saved.Id))!));
        Assert.False(await sessions.ValidAsync(saved.Id, winner.Session.Id, winner.Session.SecurityStamp, default, "mfa"));
        Assert.True(await sessions.ValidAsync(saved.Id, winner.Session.Id, winner.Session.SecurityStamp, default, "recovery"));
    }

    [Fact]
    public async Task Another_operator_reviews_a_reset_that_is_consumed_with_the_proved_replacement_device()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var recovery = fixture.Services.GetRequiredService<MfaRecoveryService>();
        fixture.AsRecovery(fixture.FirstAdmin);
        var request = await recovery.RequestAsync(new RequestMfaRecoveryDto { OperationId = Guid.NewGuid(), CurrentPassword = Password, Reason = "Isolated lost-device review" }, default);
        fixture.As(fixture.FirstAdmin);
        var ownReview = await Assert.ThrowsAsync<DomainException>(() => recovery.ReviewAsync(fixture.FirstAdmin, request.Id,
            new ReviewMfaRecoveryDto { OperationId = Guid.NewGuid(), Approve = true }, default));
        Assert.Equal("independent_review_required", ownReview.Code);
        fixture.As(fixture.SecondAdmin);
        var row = await recovery.GetForOperatorAsync(fixture.FirstAdmin, request.Id, default);
        var review = await recovery.ReviewAsync(fixture.FirstAdmin, request.Id, Review(row.Version), default);
        Assert.Equal("Approved", review.Status);
        Assert.NotNull(review.VerificationReference);
        fixture.AsRecovery(fixture.FirstAdmin);
        Assert.Null((await recovery.GetOwnAsync(request.Id, default)).Value.VerificationReference);
        var security = fixture.Services.GetRequiredService<MfaSecurityService>();
        var setup = await security.BeginAsync(new BeginMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            RecoveryRequestId = Guid.Parse(request.Id)
        }, default);
        await security.CompleteAsync(new CompleteMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            EnrollmentId = Guid.Parse(setup.EnrollmentId),
            CurrentPassword = Password,
            Code = TestAuthenticator.Code(setup.SharedKey)
        }, default);
        Assert.Equal("Consumed", (await recovery.GetOwnAsync(request.Id, default)).Value.Status);
        var users = fixture.Services.GetRequiredService<ParishUserManager>();
        var account = (await users.FindByIdAsync(fixture.FirstAdmin))!;
        Assert.True(account.PlatformOperator);
        Assert.True(await users.VerifyTwoFactorTokenAsync(account, TokenOptions.DefaultAuthenticatorProvider, TestAuthenticator.Code(setup.SharedKey)));
        await Assert.ThrowsAsync<DomainException>(() => security.BeginAsync(new BeginMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            RecoveryRequestId = Guid.Parse(request.Id)
        }, default));
        fixture.AsRecovery(fixture.Other);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => recovery.GetOwnAsync(request.Id, default))).Kind);
    }

    [Theory]
    [InlineData("expired")]
    [InlineData("rejected")]
    [InlineData("reviewer-revoked")]
    [InlineData("security-version-changed")]
    public async Task Invalid_recovery_approvals_do_not_change_credentials(string condition)
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        fixture.AsRecovery(fixture.FirstAdmin);
        var recovery = fixture.Services.GetRequiredService<MfaRecoveryService>();
        var request = await recovery.RequestAsync(new RequestMfaRecoveryDto { OperationId = Guid.NewGuid(), CurrentPassword = Password, Reason = "Isolated review fixture" }, default);
        fixture.As(fixture.SecondAdmin);
        var row = await recovery.GetForOperatorAsync(fixture.FirstAdmin, request.Id, default);
        var decision = Review(row.Version);
        decision.Approve = condition != "rejected";
        await recovery.ReviewAsync(fixture.FirstAdmin, request.Id, decision, default);
        var users = fixture.Services.GetRequiredService<ParishUserManager>();
        if (condition == "expired")
            fixture.Clock.Now = fixture.Clock.Now.AddMinutes(31);
        if (condition == "reviewer-revoked")
        {
            var reviewer = (await users.FindByIdAsync(fixture.SecondAdmin))!;
            reviewer.PlatformOperator = false;
            Assert.True((await users.UpdateAsync(reviewer)).Succeeded);
        }
        if (condition == "security-version-changed")
            Assert.True((await users.UpdateSecurityStampAsync((await users.FindByIdAsync(fixture.FirstAdmin))!)).Succeeded);
        var before = (await users.FindByIdAsync(fixture.FirstAdmin))!;
        fixture.AsRecovery(fixture.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => fixture.Services.GetRequiredService<MfaSecurityService>().BeginAsync(new BeginMfaEnrollmentDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            RecoveryRequestId = Guid.Parse(request.Id)
        }, default));
        Assert.Equal(before.AuthenticatorKey, (await users.FindByIdAsync(fixture.FirstAdmin))!.AuthenticatorKey);
    }

    [Fact]
    public async Task Protected_recovery_codes_cannot_be_moved_to_a_different_account()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        fixture.As(fixture.Nominee);
        await fixture.Services.GetRequiredService<MfaSecurityService>().RegenerateAsync(new RegenerateRecoveryCodesDto
        {
            OperationId = Guid.NewGuid(),
            CurrentPassword = Password,
            CurrentCode = TestAuthenticator.Code()
        }, default);
        var users = fixture.Services.GetRequiredService<ParishUserManager>();
        var source = (await users.FindByIdAsync(fixture.Nominee))!;
        var other = (await users.FindByIdAsync(fixture.Other))!;
        other.ProtectedRecoveryCodes = source.ProtectedRecoveryCodes;
        await Assert.ThrowsAsync<CryptographicException>(() => users.CountRecoveryCodesAsync(other));
    }

    private static ReviewMfaRecoveryDto Review(string version) => new()
    {
        OperationId = Guid.NewGuid(),
        Version = version,
        Approve = true,
        CurrentPassword = Password,
        CurrentCode = TestAuthenticator.Code(),
        Reason = "Independent isolated review",
        VerificationReference = "Isolated actual-identity review evidence"
    };
}
