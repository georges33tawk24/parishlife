using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Web.Pages.People;

[Authorize]
public class ProfileModel : PageModel
{
    private readonly AppDbContext _db;
    public ProfileModel(AppDbContext db) => _db = db;

    public record RoleRow(string Group, CommitteeRole Role, DateOnly Start, DateOnly? End);

    public bool Found { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public SystemRole ParishRole { get; private set; }
    public List<RoleRow> Current { get; private set; } = new();
    public List<RoleRow> Past { get; private set; } = new();

    public async Task OnGetAsync([FromQuery] string id)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == id);

        // The membership lookup is tenant-filtered — a person outside the viewer's parish resolves to
        // null, so cross-parish profiles are never shown (defense in depth on top of the query filters).
        var membership = await _db.Memberships.FirstOrDefaultAsync(m => m.UserId == id);
        if (user is null || membership is null) return;

        Found = true;
        Name = user.DisplayName ?? user.Email!;
        ParishRole = membership.Role;

        var rows = await (from gm in _db.GroupMembers
                          join g in _db.Groups on gm.GroupId equals g.Id
                          where gm.UserId == id
                          orderby gm.StartDate descending
                          select new RoleRow(g.Name, gm.Role, gm.StartDate, gm.EndDate))
                         .ToListAsync();

        Current = rows.Where(r => r.End is null).ToList();
        Past = rows.Where(r => r.End is not null).ToList();
    }
}
