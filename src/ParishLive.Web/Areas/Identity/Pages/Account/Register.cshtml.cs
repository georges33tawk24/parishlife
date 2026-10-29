using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using ParishLive.Infrastructure.Identity;

namespace ParishLive.Web.Areas.Identity.Pages.Account;

[AllowAnonymous]
public sealed class RegisterModel(UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn, IConfiguration configuration) : PageModel
{
    [BindProperty] public string GivenName { get; set; } = "";
    [BindProperty] public string FamilyName { get; set; } = "";
    [BindProperty] public DateOnly? BirthDate { get; set; }
    [BindProperty] public string Contact { get; set; } = "";
    [BindProperty] public string Password { get; set; } = "";
    [BindProperty] public string ConfirmPassword { get; set; } = "";
    [BindProperty] public string Language { get; set; } = "en";
    [BindProperty] public bool NoticeAccepted { get; set; }
    [BindProperty(SupportsGet = true)] public string? ReturnUrl { get; set; }
    public string? Error { get; private set; }
    public bool PolicyConfigured => configuration.GetValue<int?>("Signup:MinimumAge") is > 0 &&
        !string.IsNullOrWhiteSpace(configuration["Signup:AgePolicyApprovalReference"]);
    public void OnGet() => Language = System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName;
    public async Task<IActionResult> OnPostAsync()
    {
        Password ??= ""; ConfirmPassword ??= ""; Contact ??= "";
        if (!PolicyConfigured) return Failure("Auth.AgePolicy");
        if (string.IsNullOrWhiteSpace(GivenName) || string.IsNullOrWhiteSpace(FamilyName) || GivenName.Length > 200 || FamilyName.Length > 200 ||
            BirthDate is null || Language is not ("en" or "fr" or "ar") || !NoticeAccepted) return Failure("Error.Invalid");
        var minimum = configuration.GetValue<int>("Signup:MinimumAge");
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.UtcNow, "Asia/Beirut").DateTime);
        if (BirthDate > today.AddYears(-minimum)) return Failure("Auth.AgePolicy");
        if (Password.Length is < 16 or > 200 || Password != ConfirmPassword) return Failure("Auth.PasswordHelp");
        var contact = Contact.Trim(); var isPhone = Regex.IsMatch(contact, "^\\+[1-9][0-9]{7,14}$");
        var isEmail = new System.ComponentModel.DataAnnotations.EmailAddressAttribute().IsValid(contact) && contact.Contains('@');
        if (!isEmail && !isPhone) return Failure("Error.Invalid");
        if (await users.FindByNameAsync(contact) is not null || isEmail && await users.FindByEmailAsync(contact) is not null ||
            isPhone && await users.Users.AnyAsync(u => u.PhoneNumber == contact)) return Failure("Auth.ContactUnavailable");
        var user = new ApplicationUser { UserName = contact, Email = isEmail ? contact : null, PhoneNumber = isPhone ? contact : null,
            DisplayName = GivenName.Trim() + " " + FamilyName.Trim(), BirthDate = BirthDate, InterfaceLanguage = Language,
            EmailConfirmed = false, PhoneNumberConfirmed = false };
        var result = await users.CreateAsync(user, Password);
        if (!result.Succeeded) return Failure("Auth.ContactUnavailable");
        // Account only: no person, household, parish membership, ministry or staff assignment is created.
        await signIn.SignInAsync(user, false);
        return LocalRedirect(Url.IsLocalUrl(ReturnUrl) ? ReturnUrl! : "/");
    }
    private IActionResult Failure(string key)
    {
        Password = ConfirmPassword = ""; ModelState.Remove(nameof(Password)); ModelState.Remove(nameof(ConfirmPassword));
        Error = key; return Page();
    }
}
