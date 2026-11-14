// Purpose: keeps the holder's own handwritten signature image (an SVG path) privately in their account partition.
// Main functions: GetAsync (the holder's own image and its version), SaveAsync (first save or conditional replace, idempotent by
// OperationId) and RemoveAsync (conditional removal, idempotent). Only a normal personal sign-in qualifies: never an acting appointment or
// a recovery session, and an MFA account needs its MFA session. The image signs nothing and is never shown to anyone else here; whether
// and how a stored image may appear on certificates or letters is an open owner decision (U05). Receipts and audit hold no drawing or title.

using ParishLife.Api.DTOs.Accounts.Signature;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Accounts;

public class AccountSignatureService(IRecordTransactions records, MfaAccountAccess access, ParishUserManager users, ICurrentActor actor, TimeProvider clock)
{
    private const string Key = "accountSignature";
    private const int MaximumDrawing = 60000;

    public async Task<AccountSignatureStatusDto> GetAsync(CancellationToken ct)
    {
        var user = await EligibleAsync(ct);
        return Project(await ReadAsync(user.Id, ct));
    }

    public async Task<AccountSignatureStatusDto> SaveAsync(SaveAccountSignatureDto request, CancellationToken ct)
    {
        var user = await EligibleAsync(ct);
        var drawing = Drawing(request.Drawing);
        var title = Line(request.Title, "Title", 80);
        var titleAr = Line(request.TitleAr, "Arabic title", 80);
        var version = string.IsNullOrWhiteSpace(request.Version) ? null : request.Version;
        var operation = Operation.Create(request.OperationId, user.Id,
            new { Kind = "signature.save", Version = version, Drawing = drawing, Title = title, TitleAr = titleAr }, clock, "account-signature:v1");
        var scope = MfaRecoveryService.Scope(user.Id);
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is not null)
            return Project(await ReadAsync(user.Id, ct));
        var current = await ReadAsync(user.Id, ct);
        if (current?.Version != version)
            throw Conflict();
        var value = new AccountSignature { AccountId = user.Id, Drawing = drawing, Title = title, TitleAr = titleAr, UpdatedAt = operation.At };
        var change = current is null ? RecordChange.Create(Key, Key, value) : RecordChange.Replace(Key, Key, value, current.Version);
        await records.CommitAsync(scope, operation, "account.signature_saved", user.Id, [change], new CommandResult { Id = user.Id, Status = "Saved" }, ct);
        return Project(await ReadAsync(user.Id, ct));
    }

    public async Task<AccountSignatureStatusDto> RemoveAsync(RemoveAccountSignatureDto request, CancellationToken ct)
    {
        var user = await EligibleAsync(ct);
        var version = Versions.Require(request.Version);
        var operation = Operation.Create(request.OperationId, user.Id, new { Kind = "signature.remove", Version = version }, clock, "account-signature:v1");
        var scope = MfaRecoveryService.Scope(user.Id);
        if (await records.ReplayAsync<CommandResult>(scope, operation, ct) is not null)
            return Project(await ReadAsync(user.Id, ct));
        var current = await ReadAsync(user.Id, ct) ?? throw new DomainException("resource_not_found", "No signature image is stored.", FailureKind.NotFound);
        if (current.Version != version)
            throw Conflict();
        await records.CommitAsync(scope, operation, "account.signature_removed", user.Id, [RecordChange.Remove(Key, current.Version)],
            new CommandResult { Id = user.Id, Status = "Removed" }, ct);
        return Project(null);
    }

    private async Task<ParishUser> EligibleAsync(CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null || access.RecoverySession)
            throw new DomainException("personal_capacity_required", "Use a normal personal sign-in for your own signature image.", FailureKind.Forbidden);
        var user = await access.CurrentAsync(ct);
        if (await users.IsLockedOutAsync(user))
            throw new DomainException("account_unavailable", "The current account is unavailable.", FailureKind.Forbidden);
        return user.TwoFactorEnabled || user.PlatformOperator ? await access.RequireMfaAsync(ct) : user;
    }

    private async Task<Versioned<AccountSignature>?> ReadAsync(string account, CancellationToken ct)
    {
        var row = await records.ReadAsync<AccountSignature>(MfaRecoveryService.Scope(account), Key, ct);
        if (row is not null && row.Value.AccountId != account)
            throw new DomainException("signature_unavailable", "The signature image is unavailable.", FailureKind.Unavailable);
        return row;
    }

    private static AccountSignatureStatusDto Project(Versioned<AccountSignature>? row) => new()
    {
        Eligible = true,
        Version = row?.Version,
        Signature = row is null ? null : new AccountSignatureDto
        { Drawing = row.Value.Drawing, Title = row.Value.Title, TitleAr = row.Value.TitleAr, UpdatedAt = row.Value.UpdatedAt }
    };

    // Only path commands M, L and Q with plain numbers: nothing that could carry markup, links or script into the image.
    private static string Drawing(string? value)
    {
        var drawing = value?.Trim() ?? string.Empty;
        if (drawing.Length is < 4 or > MaximumDrawing || drawing[0] != 'M' || drawing.Any(c => !(char.IsAsciiDigit(c) || c is 'M' or 'L' or 'Q' or ' ' or '.' or '-')))
            throw new DomainException("invalid_signature", "The signature must be a drawn path of M, L and Q segments.");
        if (!drawing.Any(char.IsAsciiDigit))
            throw new DomainException("invalid_signature", "The signature is empty.");
        return drawing;
    }

    private static string? Line(string? value, string name, int maximum)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;
        var text = Guard.Text(value, name, maximum);
        if (text.Any(char.IsControl))
            throw new DomainException("invalid_signature", name + " must be one line of plain text.");
        return text;
    }

    private static DomainException Conflict() =>
        new("write_conflict", "The signature image changed. Reload before saving or removing it.", FailureKind.Conflict);
}
