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

namespace ParishLive.Web.Pages.Finance;

[Authorize]
public sealed class IndexModel(FinanceService finance, AppDbContext db, ITenantContext tenant, OperationalAccess access,
    Microsoft.Extensions.Localization.IStringLocalizer<SharedResource> localizer) : PageModel
{
    [BindProperty(SupportsGet = true)] public bool OfficeOnly { get; set; }
    [BindProperty] public decimal Amount { get; set; }
    [BindProperty] public string Currency { get; set; } = "USD";
    [BindProperty] public MovementKind Kind { get; set; } = MovementKind.Expense;
    [BindProperty] public string Account { get; set; } = "";
    [BindProperty] public string? DestinationAccount { get; set; }
    [BindProperty] public string Fund { get; set; } = "";
    [BindProperty] public string SourceReference { get; set; } = "";
    [BindProperty] public Guid OperationId { get; set; } = Guid.NewGuid();
    public FinanceSummary Summary { get; private set; } = new(new Dictionary<string, long>(), new Dictionary<string, long>(), new Dictionary<string, long>(), DateTimeOffset.UtcNow);
    public IReadOnlyList<FinancialRequest> Requests { get; private set; } = [];
    public IReadOnlyList<LedgerMovement> Movements { get; private set; } = [];
    public string? Error { get; private set; }
    public bool CanWrite => tenant.ActingRole is "Treasurer" || OfficeOnly && tenant.ActingRole is "Secretary";
    public bool CanApprove => tenant.ActingRole == "Treasurer";
    private Guid Parish => tenant.ParishIds.Count == 1 ? tenant.ParishIds.Single() : Guid.Empty;
    public async Task OnGetAsync() => await LoadAsync();
    private async Task LoadAsync()
    {
        try
        {
            Summary = await finance.SummaryAsync(Parish, OfficeOnly);
            Requests = await db.FinancialRequests.AsNoTracking().Where(r => !OfficeOnly || r.Account == "OfficeCash").ToListAsync();
            Movements = await db.LedgerMovements.AsNoTracking().Where(m => !OfficeOnly || m.Account == "OfficeCash" || m.DestinationAccount == "OfficeCash").ToListAsync();
        }
        catch (ForbiddenException) { Error = "Error.Unavailable"; }
    }
    public async Task<IActionResult> OnPostAsync(string action, Guid id, long revision, string? actualEvidence, string? actualAt, string? method)
    {
        try
        {
            if (action == "Submit") await finance.SubmitAsync(new MoneyCommand(Parish, Kind, Amount, Currency,
                OfficeOnly ? "OfficeCash" : Account, DestinationAccount, Fund, SourceReference, OperationId));
            else if (action == "Approve") await finance.ApproveAsync(id, revision, OperationId);
            else if (action == "Pay") await finance.PayAsync(id, revision, actualEvidence ?? "", Forms.UtcInput.Parse(actualAt), OperationId);
            else if (action == "Receive" && !OfficeOnly) await finance.ReceiveAsync(new(Parish, MovementKind.Receipt, Amount, Currency,
                Account, null, Fund, SourceReference, OperationId), method ?? "", Forms.UtcInput.Parse(actualAt), new Dictionary<string, decimal>());
            else throw new DomainException("Error.State");
            return RedirectToPage(new { officeOnly = OfficeOnly, actingAs = tenant.ActingAssignmentId });
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException) { Error = ex.Message; await LoadAsync(); return Page(); }
    }
    public async Task<IActionResult> OnGetExportAsync()
    {
        try
        {
            if (OfficeOnly) await access.RequireAsync(Parish, ParishLive.Domain.Enums.SystemRole.Priest, ParishLive.Domain.Enums.SystemRole.Secretary, ParishLive.Domain.Enums.SystemRole.Treasurer);
            else await access.FinanceAsync(Parish);
            var rows = (await db.LedgerMovements.AsNoTracking().Where(m => !OfficeOnly || m.Account == "OfficeCash" || m.DestinationAccount == "OfficeCash").ToListAsync())
                .OrderBy(m => m.ActualAtUtc).ToList();
            string Cell(string value)
            {
                if (value.TrimStart().FirstOrDefault() is '=' or '+' or '-' or '@' || value.StartsWith('\t') || value.StartsWith('\r')) value = "'" + value;
                return "\"" + value.Replace("\"", "\"\"") + "\"";
            }
            var csv = new System.Text.StringBuilder("\uFEFF");
            csv.AppendLine(string.Join(",", new[] { "Finance.Source", "Finance.ActualAt", "Finance.Kind", "Finance.Amount", "Finance.Currency", "Finance.Account", "Finance.Destination", "Finance.Fund" }.Select(k => Cell(localizer[k]))));
            foreach (var row in rows)
                csv.AppendLine(string.Join(",", new[] { row.SourceReference, row.ActualAtUtc.UtcDateTime.ToString("yyyy-MM-dd HH:mm 'UTC'"), localizer["Movement." + row.Kind].Value,
                    (row.Currency == "USD" ? row.Units / 100m : row.Units).ToString(System.Globalization.CultureInfo.InvariantCulture), row.Currency, row.Account, row.DestinationAccount ?? "", row.Fund }.Select(Cell)));
            return File(System.Text.Encoding.UTF8.GetBytes(csv.ToString()), "text/csv; charset=utf-8", "permitted-ledger.csv");
        }
        catch (ForbiddenException) { return NotFound(); }
    }
}
