using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Web.Pages.Recovery;

[Authorize]
public sealed class IndexModel(OperationRunner operations) : PageModel
{
    [BindProperty(SupportsGet = true)] public Guid? OperationId { get; set; }
    public OperationResult? Result { get; private set; }
    public async Task OnGetAsync() { if (OperationId is Guid id) Result = await operations.LookupAsync(id); }
}
