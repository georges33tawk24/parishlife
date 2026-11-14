// Purpose: platform-wide lists of parishes, archdioceses and sign-in accounts for current MFA platform operators only, so administrators
// no longer have to work by pasted reference. Every read is recorded in the operator's own platform audit partition.
// Main functions: ParishesAsync, ArchdiocesesAsync, AccountsAsync and AccountAsync filter, order and page bounded reads; Project returns the
// safe account view (no credentials, recovery data or key material); StatusOf names an account's Active/Suspended/Pending state.

using System.Globalization;
using ParishLife.Api.DTOs.Administration;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Administration;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Administration;

public class PlatformDirectoryService(IPlatformDirectory directory, IParishDirectory parishes, IPlatformAccess platform, MfaAccountAccess proof,
    ICurrentActor actor, IRecordTransactions records, TimeProvider clock)
{
    internal static readonly string[] AccountStatuses = ["Active", "Suspended", "Pending"];

    public async Task<Page<ParishDto>> ParishesAsync(string? q, string? status, int size, string? cursor, CancellationToken ct)
    {
        await RequireAsync(ct);
        ParishStatus? wanted = string.IsNullOrWhiteSpace(status) ? null
            : Enum.TryParse<ParishStatus>(status.Trim(), false, out var parsed) && Enum.IsDefined(parsed) && !status.Trim().All(char.IsDigit) ? parsed
            : throw new DomainException("invalid_input", "Use PendingVerification, Verified, Closed or Suspended as the parish status.");
        var text = Search(q);
        var rows = (await parishes.AllAsync(ct))
            .Where(p => !string.IsNullOrEmpty(p.Id))
            .Where(p => wanted is null || p.Status == wanted)
            .Where(p => text is null || p.Id == text || Has(p.Name, text) || Has(p.Locality, text) || Has(p.DeclaredArchdiocese, text))
            .OrderBy(p => p.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(p => p.Id, StringComparer.Ordinal)
            .Select(ParishDto.From).ToArray();
        await RecordReadAsync("parishes", ct);
        return Slice(rows, size, cursor);
    }

    public async Task<Page<ArchdioceseDto>> ArchdiocesesAsync(string? q, int size, string? cursor, CancellationToken ct)
    {
        await RequireAsync(ct);
        var text = Search(q);
        var rows = (await directory.ArchdiocesesAsync(ct)).Select(r => r.Value)
            .Where(a => !string.IsNullOrEmpty(a.Id))
            .Where(a => text is null || a.Id == text || Has(a.Name, text) || Has(a.Locality, text))
            .OrderBy(a => a.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(a => a.Id, StringComparer.Ordinal)
            .Select(ArchdioceseDto.From).ToArray();
        await RecordReadAsync("archdioceses", ct);
        return Slice(rows, size, cursor);
    }

    public async Task<Page<Versioned<PlatformAccountDto>>> AccountsAsync(string? q, string? status, int size, string? cursor, CancellationToken ct)
    {
        await RequireAsync(ct);
        var wanted = string.IsNullOrWhiteSpace(status) ? null
            : AccountStatuses.FirstOrDefault(s => s == status.Trim())
              ?? throw new DomainException("invalid_input", "Use Active, Suspended or Pending as the account status.");
        var text = Search(q);
        var rows = (await directory.AccountsAsync(ct))
            .Where(r => !string.IsNullOrEmpty(r.Value.Id))
            .Where(r => wanted is null || StatusOf(r.Value) == wanted)
            .Where(r => text is null || r.Value.Id == text || Has(r.Value.UserName, text) || Has(r.Value.DisplayName, text) || Has(r.Value.Email, text))
            .OrderBy(r => r.Value.UserName, StringComparer.OrdinalIgnoreCase).ThenBy(r => r.Value.Id, StringComparer.Ordinal)
            .Select(r => new Versioned<PlatformAccountDto> { Value = Project(r.Value), Version = r.Version }).ToArray();
        await RecordReadAsync("accounts", ct);
        return Slice(rows, size, cursor);
    }

    public async Task<Versioned<PlatformAccountDto>> AccountAsync(string accountId, CancellationToken ct)
    {
        await RequireAsync(ct);
        var row = await ReadAccountAsync(records, accountId, ct);
        await RecordReadAsync("account:" + accountId, ct);
        return new Versioned<PlatformAccountDto> { Value = Project(row.Value), Version = row.Version };
    }

    internal static async Task<Versioned<ParishUser>> ReadAccountAsync(IRecordTransactions records, string accountId, CancellationToken ct)
    {
        var row = await records.ReadAsync<ParishUser>(new RecordScope { Area = RecordArea.Account, OwnerId = accountId }, "account", ct);
        return row is not null && row.Value.Id == accountId ? row
            : throw new DomainException("resource_not_found", "The requested account is unavailable.", FailureKind.NotFound);
    }

    internal static string StatusOf(ParishUser user) => user.Suspended ? "Suspended" : user.Active ? "Active" : "Pending";

    internal static PlatformAccountDto Project(ParishUser user) => new()
    {
        AccountId = user.Id,
        UserName = user.UserName ?? string.Empty,
        DisplayName = user.DisplayName,
        Email = user.Email,
        EmailConfirmed = user.EmailConfirmed,
        IdentityVerified = user.IdentityVerified,
        TwoFactorEnabled = user.TwoFactorEnabled,
        PlatformOperator = user.PlatformOperator,
        Status = StatusOf(user),
        CreatedAt = user.CreatedAt
    };

    private async Task RequireAsync(CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await platform.RequireOperatorAsync(ct);
    }

    // Each list or account read leaves one audit row (who, what, when; never the query text) in the reading operator's own platform partition.
    private async Task RecordReadAsync(string what, CancellationToken ct)
    {
        var op = new Operation { Id = Guid.NewGuid().ToString("N"), ActorId = actor.AccountId, Fingerprint = "platform-directory-read", At = clock.GetUtcNow() };
        await records.CommitAsync(new RecordScope { Area = RecordArea.Platform, OwnerId = "directory-reads:" + actor.AccountId }, op,
            "platform.directory.read", what, [], new CommandResult { Id = op.Id, Status = "Read" }, ct);
    }

    private static string? Search(string? q)
    {
        if (string.IsNullOrWhiteSpace(q)) return null;
        var text = q.Trim();
        return text.Length > 200 ? throw new DomainException("invalid_input", "Search text is limited to 200 characters.") : text;
    }

    private static bool Has(string? value, string text) => value?.Contains(text, StringComparison.CurrentCultureIgnoreCase) == true;

    // The cursor is the plain offset of the next row in this ordered, filtered list; a list that changes between pages may shift by a row.
    private static Page<T> Slice<T>(IReadOnlyList<T> rows, int size, string? cursor)
    {
        if (size is < 1 or > 100)
            throw new DomainException("invalid_page", "Use 1-100 rows.");
        var offset = 0;
        if (!string.IsNullOrEmpty(cursor) && (!int.TryParse(cursor, NumberStyles.None, CultureInfo.InvariantCulture, out offset) || offset > rows.Count))
            throw new DomainException("invalid_cursor", "The cursor does not match this list.");
        var next = offset + size;
        return new Page<T>
        {
            Items = rows.Skip(offset).Take(size).ToArray(),
            ContinuationToken = next < rows.Count ? next.ToString(CultureInfo.InvariantCulture) : null
        };
    }
}
