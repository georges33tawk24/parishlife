using System.Globalization;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Administration;

[Authorize]
public sealed class IndexModel(AdministrationService administration, AppDbContext db, ITenantContext tenant) : PageModel
{
    public string? Role => tenant.ActingRole;
    public IReadOnlyList<Organization> Organizations { get; private set; } = [];
    public IReadOnlyList<Parish> Parishes { get; private set; } = [];
    public IReadOnlyList<Membership> Appointments { get; private set; } = [];
    public IReadOnlyList<Membership> Invitations { get; private set; } = [];
    public IReadOnlyList<AdministrativeChangeRequest> ProtectedChanges { get; private set; } = [];
    public string? Error { get; private set; }
    public IReadOnlyDictionary<string, string> AccountLabels { get; private set; } = new Dictionary<string, string>();
    public async Task OnGetAsync() => await LoadAsync();
    private async Task LoadAsync()
    {
        var user = tenant.UserId;
        Invitations = await db.Memberships.IgnoreQueryFilters().AsNoTracking().Where(m => m.UserId == user && m.IsActive && !m.Accepted).ToListAsync();
        if (Role is not ("SuperAdmin" or "Archbishop" or "ArchdioceseAdmin" or "Priest")) return;
        Organizations = await db.Organizations.AsNoTracking().Where(o => Role == "SuperAdmin" || o.Id == tenant.OrgId).ToListAsync();
        Parishes = await db.Parishes.IgnoreQueryFilters().AsNoTracking().Where(p => Role == "SuperAdmin" ||
            p.OrgId == tenant.OrgId && (Role != "Priest" || tenant.ParishIds.Contains(p.Id))).ToListAsync();
        var ids = Parishes.Select(p => p.Id).ToArray();
        Appointments = await db.Memberships.IgnoreQueryFilters().AsNoTracking().Where(m => Role == "SuperAdmin" ||
            m.OrgId == tenant.OrgId && (Role != "Priest" || ids.Contains(m.ParishId))).ToListAsync();
        var accountIds = Appointments.Select(a => a.UserId).ToArray();
        AccountLabels = await db.Users.Where(u => accountIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.DisplayName ?? "");
        if (Role == "SuperAdmin") ProtectedChanges = await db.AdministrativeChanges.AsNoTracking().Where(c => c.Status == "Pending").ToListAsync();
    }
    public async Task<IActionResult> OnPostAsync(string action, Guid operationId, Guid id, long revision, string? reason,
        string? targetUsername, SystemRole role, Guid orgId, Guid parishId, Guid? groupId, string? starts, string? ends,
        string? english, string? french, string? arabic, string? locality, string? contact, string? jurisdiction,
        string? adoption, string? headPriest, string? currentPassword, string? authenticatorCode,
        bool mayCreateParishes, bool canReviewSensitiveConcerns, bool canViewConcernIdentity)
    {
        try
        {
            switch (action)
            {
                case "Accept": await administration.AcceptAsync(id, true); break;
                case "Decline": await administration.AcceptAsync(id, false); break;
                case "Offer":
                    if (!DateTime.TryParseExact(starts, "yyyy-MM-ddTHH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var start))
                        throw new DomainException("Error.Invalid");
                    DateTimeOffset? end = null;
                    if (!string.IsNullOrEmpty(ends))
                    {
                        if (!DateTime.TryParseExact(ends, "yyyy-MM-ddTHH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var finish)) throw new DomainException("Error.Invalid");
                        end = new DateTimeOffset(DateTime.SpecifyKind(finish, DateTimeKind.Utc));
                    }
                    await administration.OfferAppointmentAsync(new AppointmentInput(targetUsername ?? "", role, orgId, parishId, groupId,
                        new DateTimeOffset(DateTime.SpecifyKind(start, DateTimeKind.Utc)), end, reason ?? "", operationId,
                        mayCreateParishes, canReviewSensitiveConcerns, canViewConcernIdentity)); break;
                case "Revoke": await administration.RevokeAsync(id, revision, reason ?? "", operationId); break;
                case "Organization": await administration.CreateOrganizationAsync(english ?? "", french ?? "", arabic ?? "", reason ?? "", operationId); break;
                case "Parish": await administration.CreateAndActivateParishAsync(new ParishSetupInput(orgId, english ?? "", french ?? "", arabic ?? "",
                    locality ?? "", contact ?? "", jurisdiction ?? "", adoption ?? "", headPriest ?? "", reason ?? "", operationId)); break;
                case "ProtectedApprove": await administration.ApproveProtectedAppointmentAsync(id, currentPassword ?? "", authenticatorCode ?? "", operationId); break;
                case "SuspendParish": await administration.ChangeParishStatusAsync(parishId, "Suspended", reason ?? "", operationId); break;
                case "ReactivateParish": await administration.ChangeParishStatusAsync(parishId, "Active", reason ?? "", operationId); break;
                case "CloseParish": await administration.ChangeParishStatusAsync(parishId, "Closed", reason ?? "", operationId); break;
                default: throw new DomainException("Error.State");
            }
            return RedirectToPage(new { actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await LoadAsync(); return Page(); }
    }
}
