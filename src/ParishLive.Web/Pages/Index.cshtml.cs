using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Authorization;
using ParishLive.Application.Events;
using ParishLive.Application.Notices;
using ParishLive.Application.Reservations;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Web.Pages;

[Authorize]
public class IndexModel(IReservationService reservations, IEventService events, INoticeService notices, AppDbContext db) : PageModel
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

    public async Task OnGetAsync()
    {
        GreetingName = User.FindFirst(PlClaims.Name)?.Value ?? User.Identity?.Name ?? string.Empty;

        Decisions = await reservations.ListAwaitingActionAsync();

        // Counts are tenant-filtered, so they are scoped to the signed-in user's parish.
        MembersCount = await db.Memberships.CountAsync();
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
    }
}
