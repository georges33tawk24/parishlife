using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Application.Events;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Events;

[Authorize]
public sealed class AdmissionsModel(EventAdmissionService admissions, IEventService events, AppDbContext db, ITenantContext tenant) : PageModel
{
    public EventDetail Event { get; private set; } = default!;
    public IReadOnlyList<EventAdmission> Items { get; private set; } = [];
    public bool IsOperator { get; private set; }
    public string? Error { get; private set; }
    public DateTimeOffset RefreshedAtUtc { get; private set; }
    public bool RosterOnly { get; private set; }
    public async Task<IActionResult> OnGetAsync(Guid id) => await LoadAsync(id) ? Page() : NotFound();
    public async Task<IActionResult> OnGetRosterAsync(Guid id)
    {
        if (!await LoadAsync(id) || !IsOperator) return NotFound();
        RosterOnly = true; Items = Items.Where(a => a.ArrivedAtUtc is not null && a.ExitedAtUtc is null).ToList();
        return Page();
    }
    private async Task<bool> LoadAsync(Guid id)
    {
        var occurrence = await events.GetAsync(id, tenant.UserId); if (occurrence is null) return false;
        Event = occurrence;
        IsOperator = await admissions.CanOperateAsync(id);
        Items = await db.EventAdmissions.AsNoTracking().Where(a => a.EventId == id && (IsOperator || a.RequesterUserId == tenant.UserId))
            .ToListAsync();
        RefreshedAtUtc = DateTimeOffset.UtcNow; return true;
    }
    public async Task<IActionResult> OnPostAsync(Guid id, Guid admissionId, long revision, Guid operationId, string action,
        string? evidence, string? collectors, string? collectorIdentity, bool independentExit, DateOnly? verifiedBirthDate,
        bool reconcilePaper, string? actualAt, string? paperReference)
    {
        try
        {
            if (!await db.EventAdmissions.AnyAsync(a => a.Id == admissionId && a.EventId == id)) return NotFound();
            if (action == "Consent") await admissions.VerifyConsentAsync(admissionId, revision, evidence ?? "",
                (collectors ?? "").Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries), independentExit, operationId, verifiedBirthDate);
            else if (action == "Confirm") await admissions.ConfirmAsync(admissionId, revision, operationId);
            else if (action == "Arrival") await admissions.ArrivalAsync(admissionId, revision,
                reconcilePaper ? Forms.UtcInput.Parse(actualAt) : DateTimeOffset.UtcNow, operationId, reconcilePaper, paperReference);
            else if (action == "Pickup") await admissions.PickupAsync(admissionId, revision, collectorIdentity ?? "", evidence ?? "", independentExit, operationId,
                reconcilePaper ? Forms.UtcInput.Parse(actualAt) : null, reconcilePaper, paperReference);
            else throw new DomainException("Error.State");
            return RedirectToPage(new { id, actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; return await LoadAsync(id) ? Page() : NotFound(); }
    }
}
