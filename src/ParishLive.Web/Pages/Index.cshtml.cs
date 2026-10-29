using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using ParishLive.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Authorization;
using ParishLive.Application.Events;
using ParishLive.Application.Notices;
using ParishLive.Application.Reservations;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Web.Pages;

[Authorize]
public class IndexModel(IReservationService reservations, IEventService events, INoticeService notices, AppDbContext db, ITenantContext tenant) : PageModel
{
    public record ActivityRow(string Verb, string Title, string Actor, DateTimeOffset At);

    public string GreetingName { get; private set; } = string.Empty;
    public IReadOnlyList<ReservationListItem> Decisions { get; private set; } = [];
    public int MembersCount { get; private set; }
    public int GroupsCount { get; private set; }
    public int EventsCount { get; private set; }
    public int AwaitingCount => Decisions.Count;
    public IReadOnlyList<NoticeListItem> Notices { get; private set; } = [];
    public IReadOnlyList<ActivityRow> Activity { get; private set; } = [];
    public sealed record WorkItem(Guid Id, Guid AssignmentId, string Parish, string Subject, string Reference, string Stage);
    public IReadOnlyList<WorkItem> CombinedWork { get; private set; } = [];
    public sealed record FollowedParish(Guid Id, string Name, bool Primary);
    public IReadOnlyList<FollowedParish> Following { get; private set; } = [];

    public async Task<IActionResult> OnGetAsync()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var all = (await db.Memberships.IgnoreQueryFilters().AsNoTracking().Where(m => m.UserId == userId).ToListAsync())
            .Where(m => m.IsEffective(DateTimeOffset.UtcNow)).ToList();
        if (tenant.ActingAssignmentId is null && all.Count > 0) return RedirectToPage("/Context/Choose");
        GreetingName = User.FindFirst(PlClaims.Name)?.Value ?? User.Identity?.Name ?? string.Empty;
        Following = await (from follow in db.ParishFollows
            join publicParish in db.Parishes.IgnoreQueryFilters() on follow.ParishId equals publicParish.Id
            where follow.UserId == userId && publicParish.PubliclyListed && publicParish.Lifecycle == "Active"
            select new FollowedParish(publicParish.Id, publicParish.Name, follow.IsPrimary)).ToListAsync();

        Decisions = await reservations.ListAwaitingActionAsync();

        // Counts are tenant-filtered, so they are scoped to the signed-in user's parish.
        MembersCount = await db.People.CountAsync(p => p.Status == "Active");
        GroupsCount = await db.Groups.CountAsync(g => g.IsActive);
        EventsCount = await events.CountUpcomingAsync();

        Notices = await notices.ListRecentAsync(3);

        var activity = await (
            from h in db.ReservationStateHistory
            join r in db.Reservations on h.ReservationId equals r.Id
            join ts in db.WorkflowStates on h.ToStateId equals ts.Id
            join u in db.Users on h.ActorUserId equals u.Id into actor
            from u in actor.DefaultIfEmpty()
            select new
            {
                r.Title, Verb = ts.Name,
                Actor = u != null ? (u.DisplayName ?? u.Email!) : h.ActorUserId,
                h.CreatedAt
            }).ToListAsync();

        Activity = activity
            .OrderByDescending(a => a.CreatedAt).Take(4)
            .Select(a => new ActivityRow(a.Verb, a.Title, a.Actor, a.CreatedAt))
            .ToList();
        var working = all.Where(m => m.Role.ToString() == tenant.ActingRole && m.OrgId == tenant.OrgId).ToList();
        var parishes = working.Select(m => m.ParishId).ToArray();
        var office = tenant.ActingRole is "Priest" or "Secretary" or "ParishAdmin" or "ArchdioceseAdmin";
        var cases = await db.ServiceCases.IgnoreQueryFilters().AsNoTracking().Where(c =>
            c.RequesterUserId == userId || office && c.OrgId == tenant.OrgId && parishes.Contains(c.ParishId)).ToListAsync();
        var names = await db.Parishes.IgnoreQueryFilters().AsNoTracking().Where(p => parishes.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name);
        CombinedWork = cases.Select(c => new WorkItem(c.Id, working.FirstOrDefault(m => m.ParishId == c.ParishId)?.Id ?? Guid.Empty,
            names.GetValueOrDefault(c.ParishId, ""), c.SubjectName, c.Reference, c.Stage.ToString())).ToList();
        return Page();
    }
}
