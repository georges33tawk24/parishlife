using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ParishLive.Application.Notices;

namespace ParishLive.Web.Pages.Notices;

[Authorize]
public class IndexModel(INoticeService notices) : PageModel
{
    public IReadOnlyList<NoticeListItem> Items { get; private set; } = [];
    public bool CanPublish { get; private set; }

    public async Task OnGetAsync()
    {
        Items = await notices.ListRecentAsync();
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        CanPublish = userId is not null && await notices.CanPublishAsync(userId);
    }
}
