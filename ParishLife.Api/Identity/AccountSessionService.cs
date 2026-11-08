// Purpose: Stores revocable sessions and one-use MFA challenges; rechecks account eligibility and security stamps.
// Main functions: CreateAsync, CreateRecoveryAsync, CommitSessionAsync, CreateChallengeAsync, GetChallengeAsync, ValidAsync, ListAsync, RevokeAsync.

using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using static ParishLife.Api.Data.Cosmos.JsonDefaults;

namespace ParishLife.Api.Identity;

public sealed class AccountSessionService
{
    private readonly PartitionDocuments documents;
    private readonly TimeProvider clock;
    internal AccountSessionService(PartitionDocuments documents, TimeProvider clock)
    {
        this.documents = documents;
        this.clock = clock;
    }

    public Task<AccountSession> CreateAsync(ParishUser user, CancellationToken ct, Versioned<MfaChallenge>? challenge = null)
        => CommitSessionAsync(user, challenge, challenge is null ? "pwd" : "mfa", ct);

    internal Task<AccountSession> CreateRecoveryAsync(ParishUser user, Versioned<MfaChallenge> challenge, CancellationToken ct)
        => CommitSessionAsync(user, challenge, "recovery", ct);

    private async Task<AccountSession> CommitSessionAsync(ParishUser user, Versioned<MfaChallenge>? challenge, string method, CancellationToken ct)
    {
        if (!user.Active || !AccountVerification.IsVerified(user) || string.IsNullOrEmpty(user.SecurityStamp) || user.PersistenceVersion is null)
            throw new DomainException("account_unavailable", "The account is not eligible to sign in.", FailureKind.Forbidden);
        if (challenge is not null && !user.TwoFactorEnabled)
            throw new DomainException("mfa_required", "The account must have an enabled second factor.", FailureKind.Forbidden);
        var key = CosmosIdentityStore.AccountKey(user.Id);
        var session = new AccountSession(Guid.NewGuid().ToString("N"), user.Id, user.SecurityStamp, clock.GetUtcNow(),
            clock.GetUtcNow().Add(method == "recovery" ? TimeSpan.FromMinutes(15) : TimeSpan.FromHours(8)), AuthenticationMethod: method);
        var op = new Operation
        {
            Id = session.Id,
            ActorId = user.Id,
            Fingerprint = "session-create",
            At = clock.GetUtcNow()
        };
        var batch = documents.Batch(Containers.Accounts, key).ReplaceItem("account", Row("account", key, "account", user), PartitionDocuments.Match(user.PersistenceVersion)).CreateItem(Row("session:" + session.Id, key, "session", session)).CreateItem(Audit(key, op, "session.create", session.Id));
        if (challenge is not null)
        {
            if (challenge.Value.AccountId != user.Id || challenge.Value.SecurityStamp != user.SecurityStamp || challenge.Value.Consumed || challenge.Value.ExpiresAt <= clock.GetUtcNow())
                throw new DomainException("challenge_invalid", "The authentication challenge is invalid.", FailureKind.Forbidden);
            batch.ReplaceItem("mfa:" + challenge.Value.Id, Row("mfa:" + challenge.Value.Id, key, "mfaChallenge", challenge.Value with { Consumed = true }), PartitionDocuments.Match(challenge.Version));
        }
        else if (user.TwoFactorEnabled || user.PlatformOperator)
            throw new DomainException("mfa_required", "An authentication challenge is required.", FailureKind.Forbidden);
        await documents.CommitAsync(batch, ct);
        return session;
    }

    public async Task<MfaLoginChallengeDto> CreateChallengeAsync(ParishUser user, CancellationToken ct)
    {
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
        var challenge = new MfaChallenge(hash, user.Id, user.SecurityStamp!, clock.GetUtcNow().AddMinutes(5));
        var key = CosmosIdentityStore.AccountKey(user.Id);
        await documents.CreateAsync(Containers.Accounts, Row("mfa:" + hash, key, "mfaChallenge", challenge), ct);
        return new MfaLoginChallengeDto
        {
            AccountId = user.Id,
            Challenge = token,
            ExpiresAt = challenge.ExpiresAt
        };
    }

    public Task<Versioned<MfaChallenge>?> GetChallengeAsync(string accountId, string token, CancellationToken ct)
    {
        if (string.IsNullOrEmpty(token) || token.Length != 64)
            return Task.FromResult<Versioned<MfaChallenge>?>(null);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
        return documents.ReadAsync<MfaChallenge>(Containers.Accounts, CosmosIdentityStore.AccountKey(accountId), "mfa:" + hash, ct);
    }

    public async Task<bool> ValidAsync(string accountId, string sessionId, string stamp, CancellationToken ct, string? authenticationMethod = null)
    {
        var key = CosmosIdentityStore.AccountKey(accountId);
        var account = await documents.ReadAsync<ParishUser>(Containers.Accounts, key, "account", ct);
        if (account?.Value.Active != true || !AccountVerification.IsVerified(account.Value) || account.Value.SecurityStamp != stamp)
            return false;
        var session = await documents.ReadAsync<AccountSession>(Containers.Accounts, key, "session:" + sessionId, ct);
        return session is not null && !session.Value.Revoked && session.Value.ExpiresAt > clock.GetUtcNow()
            && session.Value.SecurityStamp == stamp && session.Value.AccountId == accountId
            && session.Value.AuthenticationMethod is "pwd" or "mfa" or "recovery"
            && (authenticationMethod is null || session.Value.AuthenticationMethod == authenticationMethod);
    }

    public Task<IReadOnlyList<AccountSession>> ListAsync(string accountId, CancellationToken ct) => documents.QueryAsync<AccountSession>(Containers.Accounts, CosmosIdentityStore.AccountKey(accountId), StorageQuery.Type("session"), ct, 500);
    public async Task RevokeAsync(string accountId, string sessionId, CancellationToken ct)
    {
        var key = CosmosIdentityStore.AccountKey(accountId);
        var session = await documents.ReadAsync<AccountSession>(Containers.Accounts, key, "session:" + sessionId, ct);
        if (session is null || session.Value.Revoked)
            return;
        var op = new Operation
        {
            Id = Guid.NewGuid().ToString("N"),
            ActorId = accountId,
            Fingerprint = "session-revoke",
            At = clock.GetUtcNow()
        };
        try
        {
            await documents.CommitAsync(documents.Batch(Containers.Accounts, key).ReplaceItem("session:" + sessionId, Row("session:" + sessionId, key, "session", session.Value with { Revoked = true }), PartitionDocuments.Match(session.Version)).CreateItem(Audit(key, op, "session.revoke", sessionId)), ct);
        }
        catch (DomainException ex) when (ex.Code == "write_conflict")
        {
            var current = await documents.ReadAsync<AccountSession>(Containers.Accounts, key, "session:" + sessionId, ct);
            if (current?.Value.Revoked != true)
                throw;
        }
    }
}
