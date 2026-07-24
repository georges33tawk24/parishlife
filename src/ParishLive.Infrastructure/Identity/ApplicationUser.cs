using Microsoft.AspNetCore.Identity;

namespace ParishLive.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public string? DisplayName { get; set; }
}
