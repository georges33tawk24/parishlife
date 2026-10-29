using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Operations;
using ParishLive.Web.Forms;

namespace ParishLive.Web.Pages.Finance;

[Authorize]
public sealed class GivingModel(FinanceService finance, OperationalAccess access, AppDbContext db, ITenantContext tenant) : PageModel
{
    public IReadOnlyList<GivingBatch> Batches { get; private set; } = [];
    public IReadOnlyDictionary<Guid, IReadOnlyList<GivingLine>> Lines { get; private set; } = new Dictionary<Guid, IReadOnlyList<GivingLine>>();
    public string? Error { get; private set; }
    public bool CanWrite => tenant.ActingRole == "Treasurer";
    [BindProperty] public Guid OperationId { get; set; } = Guid.NewGuid();
    private Guid Parish => tenant.ParishIds.SingleOrDefault();
    public async Task OnGetAsync() => await LoadAsync();
    private async Task LoadAsync()
    {
        try
        {
            await access.FinanceAsync(Parish);
            Batches = (await db.GivingBatches.AsNoTracking().ToListAsync()).OrderByDescending(b => b.CreatedAt).ToList();
            var lines = await db.GivingLines.AsNoTracking().ToListAsync();
            Lines = lines.GroupBy(l => l.BatchId).ToDictionary(g => g.Key, g => (IReadOnlyList<GivingLine>)g.ToList());
        }
        catch (ForbiddenException) { Error = "Error.Unavailable"; }
    }
    public async Task<IActionResult> OnPostAsync(string action, Guid id, long revision, string? source,
        string? collectedAt, decimal amount, string? currency, string? fund, long? observedUsdCents, long? observedLbp)
    {
        try
        {
            switch (action)
            {
                case "Open": await finance.OpenCountAsync(Parish, source ?? "", OperationId, UtcInput.Parse(collectedAt)); break;
                case "Line": await finance.AddCountLineAsync(id, revision, amount, currency ?? "", fund ?? "", OperationId); break;
                case "Verify":
                    var observations = new Dictionary<string, long>();
                    if (observedUsdCents is long usd) observations["USD"] = usd;
                    if (observedLbp is long lbp) observations["LBP"] = lbp;
                    await finance.VerifyCountAsync(id, revision, observations, OperationId); break;
                case "Close": await finance.CloseCountAsync(id, revision, OperationId); break;
                default: throw new DomainException("Error.State");
            }
            return RedirectToPage(new { actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await LoadAsync(); return Page(); }
    }
}
