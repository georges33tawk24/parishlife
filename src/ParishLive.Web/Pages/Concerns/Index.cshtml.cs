using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Concerns;

[Authorize]
public sealed class IndexModel(PrivateWorkService work, AppDbContext db, ITenantContext tenant) : PageModel
{
    public IReadOnlyList<ConcernView> Items { get; private set; } = [];
    public IReadOnlyDictionary<Guid, IReadOnlyList<ConcernMessage>> Messages { get; private set; } = new Dictionary<Guid, IReadOnlyList<ConcernMessage>>();
    public sealed record Reviewer(string Id, string Name, bool Sensitive);
    public IReadOnlyList<Reviewer> Reviewers { get; private set; } = [];
    public string? Error { get; private set; }
    public bool IsReviewer => tenant.ActingRole == "ConcernReviewer";
    [BindProperty] public string Narrative { get; set; } = "";
    [BindProperty] public bool Anonymous { get; set; } = true;
    [BindProperty] public bool Sensitive { get; set; } = true;
    [BindProperty] public string[] ReviewerIds { get; set; } = [];
    [BindProperty] public Guid OperationId { get; set; } = Guid.NewGuid();
    public async Task OnGetAsync() => await LoadAsync();
    private async Task LoadAsync()
    {
        Items = await work.ConcernsAsync();
        var messages = new Dictionary<Guid, IReadOnlyList<ConcernMessage>>();
        foreach (var item in Items) messages[item.Id] = await work.ConcernMessagesAsync(item.Id);
        Messages = messages;
        if (tenant.ParishIds.Count != 1) return;
        var appointments = (await db.Memberships.IgnoreQueryFilters().AsNoTracking().Where(m => m.ParishId == tenant.ParishIds.Single() &&
            m.OrgId == tenant.OrgId && m.Role == SystemRole.ConcernReviewer && m.UserId != tenant.UserId).ToListAsync())
            .Where(m => m.IsEffective(DateTimeOffset.UtcNow)).ToList();
        var ids = appointments.Select(m => m.UserId).ToArray();
        var accounts = await db.Users.Where(u => ids.Contains(u.Id)).Select(u => new { u.Id, u.DisplayName }).ToListAsync();
        Reviewers = accounts.Select(u => new Reviewer(u.Id, u.DisplayName ?? "", appointments.Any(m => m.UserId == u.Id && m.CanReviewSensitiveConcerns))).ToList();
    }
    public async Task<IActionResult> OnPostAsync()
    {
        try { await work.SubmitConcernAsync(tenant.ParishIds.SingleOrDefault(), Narrative, Anonymous, Sensitive, ReviewerIds, OperationId); return RedirectToPage(new { actingAs = tenant.ActingAssignmentId }); }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await LoadAsync(); return Page(); }
    }
    public async Task<IActionResult> OnPostReviewAsync(Guid id, long revision, string action, string? reply, string? note)
    {
        try { await work.ReviewConcernAsync(id, revision, action, reply, note, OperationId); return RedirectToPage(new { actingAs = tenant.ActingAssignmentId }); }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await LoadAsync(); return Page(); }
    }
}
