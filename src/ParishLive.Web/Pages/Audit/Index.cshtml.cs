using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ParishLive.Application.Audit;

namespace ParishLive.Web.Pages.Audit;

[Authorize]
public class IndexModel(IAuditService audit) : PageModel
{
    public IReadOnlyList<AuditEntry> Items { get; private set; } = [];
    public bool CanView { get; private set; }

    public async Task OnGetAsync()
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        CanView = userId is not null && await audit.CanViewAsync(userId);
        if (CanView)
            Items = await audit.ListRecentAsync();
    }
}
