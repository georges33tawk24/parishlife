using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Community;

[Authorize]
public sealed class IndexModel(CommunityService community, AppDbContext db, ITenantContext tenant) : PageModel
{
    public IReadOnlyList<Group> Groups { get; private set; } = [];
    public IReadOnlyList<MinistryApplication> Applications { get; private set; } = [];
    public string? Error { get; private set; }
    public string? Role => tenant.ActingRole;
    public async Task OnGetAsync() => await LoadAsync();
    private async Task LoadAsync()
    {
        var groupId = tenant.ActingAssignmentId is Guid id ? await db.Memberships.Where(m => m.Id == id).Select(m => m.GroupId).SingleOrDefaultAsync() : null;
        Groups = await db.Groups.AsNoTracking().Where(g => g.IsActive && (Role != "MinistryLeader" || g.Id == groupId)).ToListAsync();
        Applications = await db.MinistryApplications.AsNoTracking().Where(a => a.ApplicantUserId == tenant.UserId ||
            Role == "Priest" || Role == "MinistryLeader" && a.GroupId == groupId && !a.IsDeparture).ToListAsync();
    }
    public async Task<IActionResult> OnPostAsync(string action, Guid id, long revision, Guid operationId, string? reason)
    {
        try
        {
            if (action is "Apply" or "Leave") await community.ApplyAsync(id, action == "Leave", reason, operationId);
            else await community.ReviewAsync(id, revision, action, operationId);
            return RedirectToPage(new { actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await LoadAsync(); return Page(); }
    }
}
