// Purpose: a person's own account closure and data copy (privacy page: "a copy of your data, deleting your account", by request).
// Main functions: ExportAsync (the downloadable copy: account, sign-in methods without secrets, personal profile and each parish's own-data
// view for the account's own linked person, plus personal notes and tasks; never another household member or a child) and CloseAsync.
// CloseAsync: personal capacity only (no selected appointment, no recovery session), fresh proof (password, or a provider sign-in of this
// session within ten minutes for an account without one, plus the authenticator code when the account has one) and the word CLOSE.
// One account-partition transaction anonymizes the account document (no email, username, password, authenticator, recovery codes,
// passkeys or provider links; inactive; new security stamp, so every session ends at once) and removes the personal profile and drawn
// signature; the sign-in aliases are then released so the address can be used again, and the encrypted personal notes are removed in
// further batches (repeated by a retry with the same operation id). The anonymized document stays as a tombstone so audit and parish
// records that name the account id stay readable. Parish records (person, sacraments, gifts, registrations, safeguarding) stay with
// each parish under its retention; the answer says so. Platform operator accounts are closed only through the private operator procedure.

using System.Security.Claims;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.People;
using ParishLife.Api.Services.PersonalWorkspace;
using Microsoft.AspNetCore.Identity;

namespace ParishLife.Api.Services.Accounts;

public class AccountClosureService(IRecordTransactions records, MfaAccountAccess proof, ParishUserManager users, IUserStore<ParishUser> store,
    ICurrentActor actor, AccountSessionService sessions, AccountProfileService profiles, AccountRecordsService parishRecords,
    PersonDataService personData, PersonalWorkspaceService workspace, IHttpContextAccessor context, TimeProvider clock)
{
    private static readonly string[] PersonalContent = ["personalWorkspaceItem", "personalWorkspaceRevision", "personalWorkspaceCommand"];

    public static readonly string[] Removed =
    [
        "sign-in email and username (the address can be used again)", "password, authenticator, recovery codes and passkeys",
        "Google and Microsoft links", "every signed-in session", "personal profile, appearance and drawn signature", "personal notes and tasks"
    ];

    public static readonly string[] Kept =
    [
        "Records a parish keeps about you (person record, sacraments and certificates, gifts and receipts, registrations, ministry and safeguarding history) stay with that parish under its retention. Ask the parish office to close optional parish data.",
        "A closed-account marker with the account number, so the parish and security history that names it stays readable; it holds no name, email or credential."
    ];

    public async Task<AccountDataExportDto> ExportAsync(CancellationToken ct)
    {
        var user = await PersonalAsync(ct);
        var export = new AccountDataExportDto
        {
            ExportedAt = clock.GetUtcNow(), Account = AccountDto.From(user), CreatedAt = user.CreatedAt, TwoFactorEnabled = user.TwoFactorEnabled,
            Passkeys = user.Passkeys.Select(p => new PasskeyDto { Id = p.CredentialId, Name = p.Name, CreatedAt = p.CreatedAt, LastUsedAt = p.LastUsedAt, IsBackedUp = p.IsBackedUp }).ToList(),
            ExternalLogins = user.ExternalLogins.Select(l => new ExternalLoginDto { Provider = l.Provider, LinkedAt = l.LinkedAt }).ToList(),
            Profile = (await profiles.GetAsync(ct)).Value
        };
        for (string? cursor = null; ;)
        {
            var page = await workspace.ListAsync(100, cursor, null, null, ct);
            export.PersonalItems.AddRange(page.Items.Select(item => item.Value));
            if ((cursor = page.ContinuationToken) is null)
                break;
        }
        foreach (var record in await parishRecords.RecordsAsync(ct))
            export.Parishes.Add(new AccountDataParishDto { Record = record, Data = await personData.OwnDataAsync(record.ParishId, ct) });
        return export;
    }

    public async Task<AccountClosureDto> CloseAsync(CloseAccountDto request, CancellationToken ct)
    {
        if (request.Confirmation != "CLOSE")
            throw new DomainException("closure_confirmation_required", "Type CLOSE to confirm that the account should be closed.");
        var scope = MfaRecoveryService.Scope(actor.AccountId);
        // The confirmation word and proofs never enter the fingerprint or receipt.
        var operation = Operation.Create(request.OperationId, actor.AccountId, new { Kind = "account.close" }, clock, "account-close:v1");
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is not null)
        {
            await RemovePersonalContentAsync(actor.AccountId, ct);
            return Result(operation.Id, "AlreadyApplied", operation.At);
        }
        var user = await ProveAsync(request, ct);
        if (user.PlatformOperator)
            throw new DomainException("operator_account_protected", "Platform operator accounts are closed only through the private operator procedure.", FailureKind.Forbidden);
        var email = user.NormalizedEmail;
        var userName = user.NormalizedUserName;
        var external = user.ExternalLogins.Select(login => login.Provider + ":" + login.SubjectHash).ToArray();
        var changes = new List<RecordChange>();
        foreach (var key in new[] { "accountProfile", "accountSignature" })
            if (await records.ReadAsync<object>(scope, key, ct) is { } row)
                changes.Add(RecordChange.Remove(key, row.Version));
        var version = user.PersistenceVersion!;
        user.Email = user.NormalizedEmail = user.UserName = user.NormalizedUserName = user.PhoneNumber = null;
        user.EmailConfirmed = user.TwoFactorEnabled = user.IdentityVerified = false;
        user.PasswordHash = user.AuthenticatorKey = user.ProtectedRecoveryCodes = user.ContactVerificationReference = null;
        user.Passkeys = [];
        user.ExternalLogins = [];
        user.DisplayName = "Closed account";
        user.Active = false;
        user.ClosedAt = operation.At;
        user.SecurityStamp = users.CreateSecurityStamp(); // every session and pending challenge ends with the old stamp
        changes.Insert(0, RecordChange.Replace("account", "account", user, version));
        await records.CommitAsync(scope, operation, "identity.account_closed", user.Id, changes, new CommandResult { Id = user.Id, Status = "Closed" }, ct);
        var identities = (CosmosIdentityStore)store;
        if (email is not null)
            await identities.ReleaseAliasAsync(user.Id, "email", email, ct);
        if (userName is not null)
            await identities.ReleaseAliasAsync(user.Id, "username", userName, ct);
        foreach (var key in external)
            await identities.ReleaseAliasAsync(user.Id, "external", key, ct);
        // Passkey indexes stay: they hold only a credential id and keep that credential from being registered to another account.
        await RemovePersonalContentAsync(user.Id, ct);
        return Result(operation.Id, "Closed", operation.At);
    }

    private async Task<ParishUser> PersonalAsync(CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null || proof.RecoverySession)
            throw new DomainException("personal_capacity_required", "Use a normal personal sign-in for your own account data.", FailureKind.Forbidden);
        var user = await proof.CurrentAsync(ct);
        return user.TwoFactorEnabled || user.PlatformOperator ? await proof.RequireMfaAsync(ct) : user;
    }

    private async Task<ParishUser> ProveAsync(CloseAccountDto request, CancellationToken ct)
    {
        var user = await proof.CurrentAsync(ct);
        if (user.PasswordHash is not null)
            return await proof.FreshPersonalProofAsync(request.CurrentPassword, request.CurrentCode, ct);
        // An account made by provider sign-up has no password: a provider sign-in of this very session stands in for it (as for "Add a password").
        user = await PersonalAsync(ct);
        var sid = context.HttpContext?.User.FindFirstValue("sid");
        var session = sid is null ? null : await sessions.FindValidAsync(user.Id, sid, user.SecurityStamp!, ct);
        if (session is not { AuthenticationMethod: "external" } || session.CreatedAt < clock.GetUtcNow() - AccountPasswordService.FreshExternalSignIn)
            throw new DomainException("fresh_external_sign_in_required",
                "Sign out, sign in again with Google or Microsoft, then close the account within 10 minutes.", FailureKind.Forbidden);
        if (user.TwoFactorEnabled)
            await proof.AuthenticatorAsync(user, request.CurrentCode);
        return user;
    }

    // Encrypted personal notes and tasks with their history; at most 90 removals per transaction.
    private async Task RemovePersonalContentAsync(string accountId, CancellationToken ct)
    {
        var scope = MfaRecoveryService.Scope(accountId);
        foreach (var type in PersonalContent)
            while ((await records.CollectAsync<Keyed>(scope, type, ct, 90)) is { Count: > 0 } rows)
                await records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), accountId, new { Kind = "account.close.cleanup" }, clock, "account-close:v1"),
                    "identity.account_closed.cleanup", accountId, rows.Select(row => RecordChange.Remove(type + ":" + row.Value.Id, row.Version)).ToArray(),
                    new CommandResult { Id = accountId, Status = "Removed" }, ct);
    }

    private static AccountClosureDto Result(string operation, string status, DateTimeOffset at) => new()
    { OperationId = operation, Status = status, ClosedAt = at, Removed = Removed, Kept = Kept };

    private sealed class Keyed
    {
        public string Id { get; set; } = string.Empty;
    }
}
