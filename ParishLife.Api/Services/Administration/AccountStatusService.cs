// Purpose: lets a current MFA platform operator suspend or reinstate another sign-in account without deleting anything. Suspension makes the
// account inactive and rotates its security stamp, so every existing session (recovery sessions included) stops at once and every eligibility
// check that requires an active account refuses it; people, records, grants and appointments are left untouched.
// Main functions: SuspendAsync, ReinstateAsync and HistoryAsync; ChangeAsync commits the account, the immutable status change, the receipt
// and the audit row in the account's own partition with the caller's version and operation id. Requests carry no credential.

using ParishLife.Api.DTOs.Administration;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Administration;

public class AccountStatusService(IRecordTransactions records, IPlatformAccess platform, MfaAccountAccess proof, ICurrentActor actor, TimeProvider clock)
{
    private static RecordScope Scope(string accountId) => new() { Area = RecordArea.Account, OwnerId = accountId };
    private static string Key(string id) => "accountStatusChange:" + id;

    public Task<AccountStatusChangeDto> SuspendAsync(string accountId, AccountStatusActionDto request, CancellationToken ct)
        => ChangeAsync(accountId, request, suspend: true, ct);

    public Task<AccountStatusChangeDto> ReinstateAsync(string accountId, AccountStatusActionDto request, CancellationToken ct)
        => ChangeAsync(accountId, request, suspend: false, ct);

    public async Task<Page<AccountStatusChangeDto>> HistoryAsync(string accountId, int size, string? cursor, CancellationToken ct)
    {
        await RequireAsync(ct);
        await PlatformDirectoryService.ReadAccountAsync(records, accountId, ct);
        var page = await records.PageAsync<AccountStatusChange>(Scope(accountId), "accountStatusChange", size, cursor, ct);
        return new Page<AccountStatusChangeDto>
        {
            Items = page.Items.Select(r => r.Value).Where(v => v.AccountId == accountId).OrderByDescending(v => v.At).Select(Project).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    private async Task<AccountStatusChangeDto> ChangeAsync(string accountId, AccountStatusActionDto request, bool suspend, CancellationToken ct)
    {
        await RequireAsync(ct);
        var reason = Guard.Text(request.Reason, "Reason", 1000);
        var op = actor.CreateOperation(request.OperationId, new { Kind = suspend ? "account.suspend" : "account.reinstate", AccountId = accountId, request.Version, Reason = reason },
            clock, "account-status:v1:" + accountId);
        if (await records.ReplayAsync<CommandResult>(Scope(accountId), op, ct) is { } prior)
            return await ReadAsync(accountId, prior.Id, ct);
        if (accountId == actor.AccountId)
            throw new DomainException("independent_operator_required", "Another platform operator must change the status of your own account.", FailureKind.Forbidden);
        var row = await PlatformDirectoryService.ReadAccountAsync(records, accountId, ct);
        var user = row.Value;
        // Operator accounts are created and maintained only through the private operator procedure, never suspended from the list.
        if (user.PlatformOperator)
            throw new DomainException("operator_account_protected", "Platform operator accounts are changed only through the private operator procedure.", FailureKind.Forbidden);
        if (row.Version != Versions.Require(request.Version))
            throw new DomainException("write_conflict", "The account changed; reload it before changing its status.", FailureKind.Conflict);
        if (suspend ? !user.Active || user.Suspended : !user.Suspended)
            throw new DomainException("invalid_state", suspend ? "Only an active account can be suspended." : "Only a suspended account can be reinstated.", FailureKind.Conflict);
        user.Suspended = suspend;
        user.Active = !suspend;
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        var change = new AccountStatusChange
        {
            Id = op.Id, AccountId = accountId, Action = suspend ? "Suspended" : "Reinstated", Reason = reason, By = actor.AccountId, At = op.At
        };
        await records.CommitAsync(Scope(accountId), op, suspend ? "account.suspended" : "account.reinstated", accountId,
            [RecordChange.Replace("account", "account", user, row.Version), RecordChange.Create(Key(change.Id), "accountStatusChange", change)],
            new CommandResult { Id = change.Id, Status = change.Action }, ct, reason);
        return Project(change);
    }

    private async Task RequireAsync(CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await platform.RequireOperatorAsync(ct);
    }

    private async Task<AccountStatusChangeDto> ReadAsync(string accountId, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<AccountStatusChange>(Scope(accountId), Key(id), ct);
        return row is not null && row.Value.AccountId == accountId ? Project(row.Value)
            : throw new DomainException("resource_not_found", "The requested status change is unavailable.", FailureKind.NotFound);
    }

    private static AccountStatusChangeDto Project(AccountStatusChange value) => new()
    {
        Id = value.Id, AccountId = value.AccountId, Action = value.Action, Reason = value.Reason, By = value.By, At = value.At
    };
}
