using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
namespace ParishLive.Web.Areas.Identity.Pages.Account;
[AllowAnonymous]
public sealed class ForgotPasswordModel : PageModel { public void OnGet() { } }
