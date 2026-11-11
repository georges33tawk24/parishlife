// Purpose: the combined Home (D01, proposed S02.05/S03.01-S03.06). One account-level read across all the account's parishes: its own following,
// membership, pending membership and primary-parish relationships, its own unread notice counts, and the capacities it currently holds so the user
// can choose one explicitly. Capacities are listed separately and never merged; each lists only duties left after explicit denials, and the choice
// is sent per request (X-ParishLife-Appointment), so every tab keeps its own context. Office queues and records are not read here.
// Main functions: HomeAsync and CapacitiesAsync; CapacitiesCoreAsync applies the same validity rules the authorization helpers enforce
// (effective accepted appointment, verified archdiocese, matching jurisdiction, verified open parish, current seat or leader period).

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.PersonalWorkspace;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.PersonalWorkspace;

public class CombinedHomeService(IRecordTransactions records, IParishRepository parishes, IStaffAppointmentDirectory directory, IAccountDirectory accounts,
    MfaAccountAccess proof, UserManager<ParishUser> users, IHttpContextAccessor context, ICurrentActor actor, TimeProvider clock)
{
    private const int MaximumStaffRows = 500;
    private static RecordScope Parish(string id) => new() { Area = RecordArea.Parish, OwnerId = id };
    private static RecordScope Account(string id) => new() { Area = RecordArea.Account, OwnerId = id };
    private static RecordCondition Equal(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
    private static DomainException Missing() => new("resource_not_found", "The requested home is unavailable.", FailureKind.NotFound);

    private sealed class Context
    {
        public List<CapacityDto> Capacities { get; } = [];
        public HashSet<string> Followed { get; } = new(StringComparer.Ordinal);
        public Dictionary<string, Parish?> Parishes { get; } = new(StringComparer.Ordinal);
        public int PendingInvitations { get; set; }
        public bool HasStaffHistory { get; set; }
    }

    public async Task<CombinedHomeDto> HomeAsync(CancellationToken ct)
    {
        var account = await RequireAsync(ct);
        var state = await CapacitiesCoreAsync(account, ct);
        var unread = await records.CollectAsync<Notification>(Account(account), "notification", ct, 5000, Equal("status", "Unread"));
        var primary = (await records.ReadAsync<PrimaryParish>(Account(account), "primaryParish", ct))?.Value.ParishId;
        var parishes = new List<HomeParishDto>();
        foreach (var (id, parish) in state.Parishes)
        {
            if (parish is null)
                continue;
            var link = (await records.ReadAsync<PersonAccountLink>(Parish(id), "personAccountLink:" + account, ct))?.Value;
            var pending = (await records.CollectAsync<MembershipRequest>(Parish(id), "membershipRequest", ct, 200, Equal("applicantAccountId", account)))
                .Any(r => r.Value.ApplicantAccountId == account && r.Value.Status is "Submitted" or "NeedsInformation");
            parishes.Add(new HomeParishDto
            {
                ParishId = id, Name = parish.Name, Locality = parish.Locality, Status = parish.Status.ToString(), Following = state.Followed.Contains(id),
                Member = link is { Active: true } && link.AccountId == account && link.ParishId == id, MembershipPending = pending, Primary = primary == id,
                UnreadNotifications = unread.Count(n => n.Value.ParishId == id && n.Value.AccountId == account),
                CapacityKinds = state.Capacities.Where(c => c.ParishId == id).Select(c => c.Kind).Distinct(StringComparer.Ordinal).ToArray()
            });
        }
        var capacities = state.Capacities.ToArray();
        return new CombinedHomeDto
        {
            HomeState = capacities.Length switch
            {
                0 when state.HasStaffHistory => "AwaitingAssignment",
                0 => parishes.Count == 0 ? "NoParish" : "Personal",
                1 => "SingleCapacity",
                _ => "ChooseCapacity"
            },
            DirectCapacity = capacities.Length == 1 ? capacities[0] : null,
            SessionHasMfa = context.HttpContext?.User.HasClaim("amr", "mfa") == true,
            Parishes = [.. parishes.OrderByDescending(p => p.Primary).ThenBy(p => p.Name, StringComparer.OrdinalIgnoreCase)],
            Capacities = capacities, UnreadNotifications = unread.Count(n => n.Value.AccountId == account), PendingStaffInvitations = state.PendingInvitations,
            ComputedAt = clock.GetUtcNow()
        };
    }

    public async Task<IReadOnlyList<CapacityDto>> CapacitiesAsync(CancellationToken ct)
        => (await CapacitiesCoreAsync(await RequireAsync(ct), ct)).Capacities;

    // The combined home is an account-level personal read: no selected appointment, no restricted recovery session, no locked or unverified account.
    private async Task<string> RequireAsync(CancellationToken ct)
    {
        if (actor.ActingAppointmentId is not null)
            throw new DomainException("personal_context_required", "Read the combined home without a selected appointment; send the appointment only with actions taken in it.", FailureKind.Forbidden);
        if (proof.RecoverySession)
            throw Missing();
        var account = actor.AccountId;
        var user = await users.FindByIdAsync(account);
        if (user is null || await users.IsLockedOutAsync(user) || !await accounts.IsActiveVerifiedAsync(account, ct))
            throw Missing();
        return account;
    }

    private async Task<Parish?> ParishAsync(Context state, string id, CancellationToken ct)
    {
        if (!state.Parishes.TryGetValue(id, out var parish))
            state.Parishes[id] = parish = (await parishes.GetAsync(id, ct))?.Value;
        return parish;
    }

    private async Task<Context> CapacitiesCoreAsync(string account, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var state = new Context();
        var archdioceses = new Dictionary<string, Archdiocese?>(StringComparer.Ordinal);
        async Task<Archdiocese?> VerifiedArchdioceseAsync(string id)
        {
            if (!archdioceses.TryGetValue(id, out var value))
                archdioceses[id] = value = (await parishes.GetArchdioceseAsync(id, ct))?.Value;
            return value is { Verified: true } ? value : null;
        }

        foreach (var follow in await records.CollectAsync<ParishFollow>(Account(account), "parishFollow", ct, 200))
            if (await ParishAsync(state, follow.Value.ParishId, ct) is not null)
                state.Followed.Add(follow.Value.ParishId);

        string? cursor = null;
        var seen = 0;
        do
        {
            var page = await directory.ForAccountAsync(account, 100, cursor, ct);
            cursor = page.ContinuationToken;
            foreach (var row in page.Items.Select(r => r.Value).Where(r => r.AccountId == account))
            {
                if (++seen > MaximumStaffRows)
                    throw new DomainException("operation_too_large", "This account has too many appointment records to summarize.", FailureKind.Unavailable);
                state.HasStaffHistory = true;
                if (row.Status == "Invited" && row.AcceptBy > now)
                    state.PendingInvitations++;
                if (!row.IsEffective(now) || await VerifiedArchdioceseAsync(row.ArchdioceseId) is not { } organization)
                    continue;
                string[] denies = [];
                var scopeName = organization.Name;
                if (row.Role == StaffAppointmentRole.Priest)
                {
                    if (row.ParishId is null || await ParishAsync(state, row.ParishId, ct) is not { Status: ParishStatus.Verified } parish
                        || parish.JurisdictionArchdioceseId != row.ArchdioceseId)
                        continue;
                    denies = (await parishes.GetGrantAsync(row.ParishId, account, ct))?.Denies ?? [];
                    scopeName = parish.Name;
                }
                else if (row.Role != StaffAppointmentRole.ArchdioceseAdmin || row.ParishId is not null)
                    continue;
                state.Capacities.Add(new CapacityDto
                {
                    Kind = row.Role.ToString(), AppointmentId = row.Id, ArchdioceseId = row.ArchdioceseId, ParishId = row.ParishId, ScopeName = scopeName,
                    IsHead = row.IsHead(now), Capabilities = row.Allows.Except(row.Denies.Concat(denies), StringComparer.Ordinal).ToArray()
                });
            }
        }
        while (cursor is not null);

        foreach (var bishop in await directory.BishopAppointmentsForAccountAsync(account, ct))
        {
            if (bishop.AccountId != account || !bishop.IsEffective(now) || await VerifiedArchdioceseAsync(bishop.ArchdioceseId) is not { } organization)
                continue;
            var seat = await records.ReadAsync<BishopSeat>(new RecordScope { Area = RecordArea.Archdiocese, OwnerId = bishop.ArchdioceseId }, "bishopSeat", ct);
            if (seat?.Value.AppointmentId == bishop.Id)
                state.Capacities.Add(new CapacityDto { Kind = "Bishop", AppointmentId = bishop.Id, ArchdioceseId = bishop.ArchdioceseId, ScopeName = organization.Name });
        }

        // ponytail: direct parish grants and ministry leadership are discovered only in parishes the account follows or serves (grants and leader
        // records carry no parish id for a cross-partition lookup); add an account-side index if office holders must find them elsewhere.
        foreach (var (id, parish) in state.Parishes.ToArray())
        {
            if (parish is not { Status: ParishStatus.Verified })
                continue;
            var grant = await parishes.GetGrantAsync(id, account, ct);
            var allowed = grant is null ? [] : grant.Allows.Except(grant.Denies, StringComparer.Ordinal).ToArray();
            if (allowed.Length > 0)
                state.Capacities.Add(new CapacityDto { Kind = "ParishGrant", ParishId = id, ArchdioceseId = parish.JurisdictionArchdioceseId, ScopeName = parish.Name, Capabilities = allowed });
            if (grant?.Denies.Contains(Permissions.MinistriesManage, StringComparer.Ordinal) == true)
                continue;
            foreach (var leader in await records.CollectAsync<MinistryLeader>(Parish(id), "ministryLeader", ct, 200, Equal("accountId", account)))
            {
                var value = leader.Value;
                if (value.AccountId != account || !value.Current(now) || value.Role is not ("Leader" or "Assistant"))
                    continue;
                var ministry = (await records.ReadAsync<Ministry>(Parish(id), "ministry:" + value.MinistryId, ct))?.Value;
                if (ministry is null || ministry.ParishId != id)
                    continue;
                state.Capacities.Add(new CapacityDto
                {
                    Kind = "MinistryLeader", ParishId = id, ArchdioceseId = parish.JurisdictionArchdioceseId, MinistryId = value.MinistryId,
                    ScopeName = parish.Name + " / " + ministry.Name, Capabilities = [.. value.Duties]
                });
            }
        }

        var user = await users.FindByIdAsync(account);
        if (user is { Active: true, PlatformOperator: true, TwoFactorEnabled: true } && AccountVerification.IsVerified(user))
            state.Capacities.Add(new CapacityDto { Kind = "PlatformOperator", ScopeName = "Platform" });
        return state;
    }
}
