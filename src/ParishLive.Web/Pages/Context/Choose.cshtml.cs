using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Web.Pages.Context;

[Authorize]
public sealed class ChooseModel(AppDbContext db) : PageModel
{
    public sealed record Choice(Guid Id, string Parish, string Role);
    public IReadOnlyList<Choice> Choices { get; private set; } = [];
    public async Task OnGetAsync()
    {
        var user = User.FindFirstValue(ClaimTypes.NameIdentifier);
        var assignments = (await db.Memberships.IgnoreQueryFilters().AsNoTracking().Where(m => m.UserId == user).ToListAsync())
            .Where(m => m.IsEffective(DateTimeOffset.UtcNow)).ToList();
        var work = assignments.Where(m => m.Role is not (SystemRole.Member or SystemRole.PublicVisitor)).ToList();
        if (work.Count > 0) assignments = work;
        var parishes = await db.Parishes.IgnoreQueryFilters().ToDictionaryAsync(p => p.Id, p => p.Name);
        Choices = assignments.Select(m => new Choice(m.Id, parishes.GetValueOrDefault(m.ParishId, ""), m.Role.ToString())).ToList();
    }
}
