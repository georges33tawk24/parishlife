// Purpose: proves ownership of a sign-in email with one-use, expiring, attempt-bounded codes (A06): confirming a registered
// account's email and replacing the sign-in email while the old one stays active until the new one is proven.
// Main functions: RequestAsync, ConfirmAsync (anonymous, neutral responses), BeginEmailChangeAsync, ConfirmEmailChangeAsync;
// helpers Hash, Pending, FailAttemptAsync. Codes are stored only as hashes and never enter fingerprints, receipts, audit or logs.

using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Accounts;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Accounts;

public class ContactVerificationService(IRecordTransactions records, MfaAccountAccess proof, ParishUserManager users,
    IUserStore<ParishUser> store, IContactCodeDelivery delivery, TimeProvider clock)
{
    internal const int MaximumAttempts = 5;
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan ResendInterval = TimeSpan.FromMinutes(1);
    private const string ConfirmKey = "contactVerification:ConfirmEmail";
    private const string ChangeKey = "contactVerification:ChangeEmail";
    private CosmosIdentityStore Store => (CosmosIdentityStore)store;
    private string DeliveryState => delivery.Configured ? "ProviderConfigured" : "NotConfigured";

    public async Task<ContactVerificationStatusDto> RequestAsync(RequestContactVerificationDto request, CancellationToken ct)
    {
        var neutral = new ContactVerificationStatusDto { Status = "RequestReceived", Delivery = DeliveryState };
        var user = await users.FindByEmailAsync(Email(request.Email));
        // Unknown, already-confirmed and inactive accounts get the same response; without a provider nothing is generated.
        if (user is not { Active: true, EmailConfirmed: false } || user.Email is null || !delivery.Configured)
            return neutral;
        var scope = MfaRecoveryService.Scope(user.Id);
        var current = await records.ReadAsync<ContactVerification>(scope, ConfirmKey, ct);
        if (current?.Value is { Status: "Pending" } open && open.CreatedAt + ResendInterval > clock.GetUtcNow())
            return neutral;
        var code = NewCode();
        var item = Stage(user, "ConfirmEmail", user.Email, user.NormalizedEmail!, code);
        if (!await delivery.SendAsync(user.Email, code, item.Purpose, ct))
            return neutral;
        item.Delivery = "Accepted";
        var operation = Internal(user.Id, "contact.verification.requested");
        await records.CommitAsync(scope, operation, "identity.contact_verification.requested", item.Id,
            [current is null ? RecordChange.Create(ConfirmKey, "contactVerification", item) : RecordChange.Replace(ConfirmKey, "contactVerification", item, current.Version)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return neutral;
    }

    public async Task<ContactVerificationStatusDto> ConfirmAsync(ConfirmContactVerificationDto request, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(Email(request.Email));
        if (user is { Active: true, EmailConfirmed: true })
            return new ContactVerificationStatusDto { Status = "Verified", Delivery = DeliveryState };
        if (user is not { Active: true } || user.PersistenceVersion is null)
            throw Invalid();
        var scope = MfaRecoveryService.Scope(user.Id);
        var row = await records.ReadAsync<ContactVerification>(scope, ConfirmKey, ct);
        var item = Pending(row, user, user.NormalizedEmail);
        if (!Matches(item, request.Code))
            await FailAttemptAsync(scope, ConfirmKey, row!, ct);
        user.EmailConfirmed = true;
        item.Status = "Completed";
        item.CompletedAt = clock.GetUtcNow();
        await records.CommitAsync(scope, Internal(user.Id, "contact.verification.confirmed"), "identity.contact_verification.completed", item.Id,
            [RecordChange.Replace("account", "account", user, user.PersistenceVersion), RecordChange.Replace(ConfirmKey, "contactVerification", item, row!.Version)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return new ContactVerificationStatusDto { Status = "Verified", Delivery = DeliveryState };
    }

    public async Task<EmailChangeDto> BeginEmailChangeAsync(BeginEmailChangeDto request, CancellationToken ct)
    {
        var user = await proof.FreshPersonalProofAsync(request.CurrentPassword, request.CurrentCode, ct);
        var email = Email(request.NewEmail);
        var normalized = users.NormalizeEmail(email)!;
        if (normalized == user.NormalizedEmail)
            throw new DomainException("email_unchanged", "Enter a different email address.");
        var scope = MfaRecoveryService.Scope(user.Id);
        var operation = Operation.Create(request.OperationId, user.Id, new { Kind = "email.change.begin", NewEmail = normalized }, clock, "account-email:v1");
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is { } prior)
            return View((await records.ReadAsync<ContactVerification>(scope, ChangeKey, ct))?.Value is { } saved && saved.Id == prior.Id
                ? saved : throw new DomainException("email_change_superseded", "A later email change replaced this one.", FailureKind.Conflict));
        if (!delivery.Configured)
            throw new DomainException("contact_delivery_unavailable", "No email delivery provider is configured, so a new address cannot be verified. Use the office identity-review route.", FailureKind.Unavailable);
        var code = NewCode();
        var item = Stage(user, "ChangeEmail", email, normalized, code, operation.Id);
        // The code goes only to the replacement address; the current email stays the active sign-in alias until confirmation.
        if (!await delivery.SendAsync(email, code, item.Purpose, ct))
            throw new DomainException("contact_delivery_failed", "The verification code could not be handed to the delivery provider. Try again later.", FailureKind.Unavailable);
        item.Delivery = "Accepted";
        var current = await records.ReadAsync<ContactVerification>(scope, ChangeKey, ct);
        await records.CommitAsync(scope, operation, "identity.email_change.requested", item.Id,
            [RecordChange.Replace("account", "account", user, user.PersistenceVersion!),
             current is null ? RecordChange.Create(ChangeKey, "contactVerification", item) : RecordChange.Replace(ChangeKey, "contactVerification", item, current.Version)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return View(item);
    }

    public async Task<AccountSecurityChangeDto> ConfirmEmailChangeAsync(ConfirmEmailChangeDto request, CancellationToken ct)
    {
        var user = await proof.FreshPersonalProofAsync(request.CurrentPassword, request.CurrentCode, ct);
        var changeId = Guard.Id(request.ChangeId);
        var scope = MfaRecoveryService.Scope(user.Id);
        var operation = Operation.Create(request.OperationId, user.Id, new { Kind = "email.change.confirm", ChangeId = changeId }, clock, "account-email:v1");
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is not null)
            return Change(operation.Id, "AlreadyApplied", changeId);
        var row = await records.ReadAsync<ContactVerification>(scope, ChangeKey, ct);
        var item = row?.Value.Id == changeId ? Pending(row, user, null) : throw Invalid();
        if (!Matches(item, request.Code))
            await FailAttemptAsync(scope, ChangeKey, row!, ct);
        var oldEmail = user.NormalizedEmail;
        var oldUserName = user.NormalizedUserName;
        var userNameFollowsEmail = oldEmail is not null && oldUserName == oldEmail;
        var claimed = new List<(string Kind, string Value)>();
        try
        {
            foreach (var alias in userNameFollowsEmail ? new[] { ("email", item.NormalizedTarget), ("username", users.NormalizeName(item.TargetEmail)!) } : [("email", item.NormalizedTarget)])
            {
                if (!await Store.ClaimAliasAsync(user.Id, alias.Item1, alias.Item2, ct))
                    throw new DomainException("email_unavailable", "This email address cannot be used for sign-in.", FailureKind.Conflict);
                claimed.Add(alias);
            }
            user.Email = item.TargetEmail;
            user.NormalizedEmail = item.NormalizedTarget;
            user.EmailConfirmed = true;
            if (userNameFollowsEmail)
            {
                user.UserName = item.TargetEmail;
                user.NormalizedUserName = users.NormalizeName(item.TargetEmail);
            }
            user.SecurityStamp = users.CreateSecurityStamp(); // Other sessions end after a sign-in identifier change.
            user.AccessFailedCount = 0;
            item.Status = "Completed";
            item.CompletedAt = clock.GetUtcNow();
            await records.CommitAsync(scope, operation, "identity.email_change.completed", item.Id,
                [RecordChange.Replace("account", "account", user, user.PersistenceVersion!), RecordChange.Replace(ChangeKey, "contactVerification", item, row!.Version)],
                new CommandResult { Id = item.Id, Status = item.Status }, ct);
        }
        catch
        {
            foreach (var alias in claimed)
                await Store.ReleaseAliasAsync(user.Id, alias.Kind, alias.Value, CancellationToken.None);
            throw;
        }
        if (oldEmail is not null)
            await Store.ReleaseAliasAsync(user.Id, "email", oldEmail, ct);
        if (userNameFollowsEmail)
            await Store.ReleaseAliasAsync(user.Id, "username", oldUserName!, ct);
        return Change(operation.Id, "Applied", item.Id);
    }

    private ContactVerification Stage(ParishUser user, string purpose, string email, string normalized, string code, string? id = null)
    {
        id ??= Guid.NewGuid().ToString("N");
        return new ContactVerification
        {
            Id = id,
            AccountId = user.Id,
            Purpose = purpose,
            TargetEmail = email,
            NormalizedTarget = normalized,
            CodeHash = Hash(id, code),
            SecurityStampAtStart = user.SecurityStamp!,
            CreatedAt = clock.GetUtcNow(),
            ExpiresAt = clock.GetUtcNow().Add(Lifetime)
        };
    }

    private ContactVerification Pending(Versioned<ContactVerification>? row, ParishUser user, string? normalizedTarget)
    {
        if (row?.Value is not { Status: "Pending" } item || item.AccountId != user.Id || item.SecurityStampAtStart != user.SecurityStamp
            || item.ExpiresAt <= clock.GetUtcNow() || item.Attempts >= MaximumAttempts
            || normalizedTarget is not null && item.NormalizedTarget != normalizedTarget)
            throw Invalid();
        return item;
    }

    private async Task FailAttemptAsync(RecordScope scope, string key, Versioned<ContactVerification> row, CancellationToken ct)
    {
        row.Value.Attempts++;
        try
        {
            await records.CommitAsync(scope, Internal(row.Value.AccountId, "contact.verification.failed"), "identity.contact_verification.failed", row.Value.Id,
                [RecordChange.Replace(key, "contactVerification", row.Value, row.Version)], new CommandResult { Id = row.Value.Id, Status = "AttemptFailed" }, ct);
        }
        catch (DomainException error) when (error.Code == "write_conflict")
        {
            // A concurrent attempt changed the record; this attempt still fails.
        }
        throw Invalid();
    }

    private Operation Internal(string accountId, string kind) => Operation.Create(Guid.NewGuid(), accountId, new { Kind = kind }, clock, "account-contact:v1");

    private static bool Matches(ContactVerification item, string? code)
        => code is not null && code.Length <= 12 && CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(item.CodeHash), Encoding.ASCII.GetBytes(Hash(item.Id, code.Trim())));

    private static string Hash(string id, string code) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("contact-code:v1\n" + id + "\n" + code)));

    private static string NewCode() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);

    private static string Email(string? value)
    {
        var email = Guard.Text(value, "Email", 254);
        if (!MailAddress.TryCreate(email, out var parsed) || parsed.Address != email)
            throw new DomainException("invalid_email", "A valid email address is required.");
        return email;
    }

    private static EmailChangeDto View(ContactVerification item) => new()
    { ChangeId = item.Id, NewEmail = item.TargetEmail, Status = item.Status, Delivery = item.Delivery, ExpiresAt = item.ExpiresAt };

    private static AccountSecurityChangeDto Change(string operation, string status, string id) => new()
    { OperationId = operation, Status = status, ResourceId = id, RequiresSignIn = true };

    private static DomainException Invalid() => new("verification_invalid", "The code is invalid, expired or used up. Request a new code.");
}
