using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Web.Pages.People;

[Authorize]
public class IndexModel : PageModel
{
    private readonly AppDbContext _db;
    public IndexModel(AppDbContext db) => _db = db;

    public record Row(string Id, string Name, SystemRole Role);
    public List<Row> Members { get; private set; } = new();

    public async Task OnGetAsync()
    {
        // Memberships are tenant-filtered, so this only lists members of the viewer's parish.
        Members = await (from m in _db.Memberships
                         join u in _db.Users on m.UserId equals u.Id
                         orderby u.DisplayName
                         select new Row(u.Id, u.DisplayName ?? u.Email!, m.Role))
                        .ToListAsync();
    }
}
