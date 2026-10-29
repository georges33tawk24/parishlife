using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Notifications;

[Authorize]
public sealed class IndexModel(AppDbContext db, ParishCaseService cases) : PageModel
{
    public sealed record Row(Guid Id, Guid RecordId, string Reference, string Code, DateTimeOffset At, bool Read);
    public IReadOnlyList<Row> Items { get; private set; } = [];
    public async Task OnGetAsync()
    {
        var rows = await db.AccountNotifications.AsNoTracking().ToListAsync();
        var permitted = new List<Row>();
        foreach (var row in rows)
        {
            var record = row.MessageCode == "M05" ? null : await cases.GetAsync(row.RecordId);
            var allowed = row.MessageCode == "M05" ? await db.Concerns.AnyAsync(c => c.Id == row.RecordId) : record is not null;
            if (allowed) permitted.Add(new(row.Id, row.RecordId, record?.Reference ?? "", row.MessageCode, row.CreatedAtUtc, row.ReadAtUtc is not null));
        }
        Items = permitted.OrderByDescending(r => r.At).ToList();
    }
    public async Task<IActionResult> OnPostReadAsync(Guid id)
    {
        await OnGetAsync();
        if (!Items.Any(i => i.Id == id)) return NotFound();
        var row = await db.AccountNotifications.SingleAsync(n => n.Id == id); row.ReadAtUtc = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(); return RedirectToPage();
    }
}
