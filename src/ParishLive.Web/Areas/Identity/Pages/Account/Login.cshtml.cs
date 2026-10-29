using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Infrastructure.Identity;

namespace ParishLive.Web.Areas.Identity.Pages.Account;

[AllowAnonymous]
public sealed class LoginModel(SignInManager<ApplicationUser> signIn, UserManager<ApplicationUser> users) : PageModel
{
    [BindProperty] public string Identifier { get; set; } = "";
    [BindProperty] public string Password { get; set; } = "";
    [BindProperty] public bool RememberMe { get; set; }
    [BindProperty(SupportsGet = true)] public string? ReturnUrl { get; set; }
    public string? Error { get; private set; }
    public void OnGet() { }
    public async Task<IActionResult> OnPostAsync()
    {
        var supplied = (Identifier ?? "").Trim(); Password ??= "";
        var byName = await users.FindByNameAsync(supplied);
        var normalizedEmail = users.NormalizeEmail(supplied);
        var byEmail = supplied.Contains('@') ? await users.Users.Where(u => u.NormalizedEmail == normalizedEmail).Take(2).ToListAsync() : [];
        var byPhone = supplied.StartsWith('+') ? await users.Users.Where(u => u.PhoneNumber == supplied).Take(2).ToListAsync() : [];
        var candidates = byEmail.Concat(byPhone).Concat(byName is null ? [] : new[] { byName }).DistinctBy(u => u.Id).ToList();
        if (candidates.Count == 1 && Password.Length <= 200)
        {
            var result = await signIn.PasswordSignInAsync(candidates[0]!, Password, RememberMe, lockoutOnFailure: true);
            if (result.Succeeded) return LocalRedirect(Url.IsLocalUrl(ReturnUrl) ? ReturnUrl! : "/");
            if (result.RequiresTwoFactor) return RedirectToPage("./LoginWith2fa", new { ReturnUrl, RememberMe });
        }
        Password = ""; ModelState.Remove(nameof(Password)); Error = "Auth.Failed"; return Page();
    }
}
