using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ParishLive.Application.Operations;
using ParishLive.Infrastructure.Operations;

namespace ParishLive.Web.Pages.Requests;

[Authorize]
public sealed class IndexModel(ParishCaseService cases) : PageModel
{
    public IReadOnlyList<CaseView> Items { get; private set; } = [];
    public async Task OnGetAsync() => Items = await cases.ListAsync();
}
