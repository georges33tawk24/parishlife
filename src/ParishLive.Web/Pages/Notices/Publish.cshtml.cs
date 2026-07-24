using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using ParishLive.Application.Common;
using ParishLive.Application.Notices;
using ParishLive.Domain.Common;
using ParishLive.Domain.Enums;

namespace ParishLive.Web.Pages.Notices;

[Authorize]
public class PublishModel(INoticeService notices) : PageModel
{
    [BindProperty]
    public InputModel Form { get; set; } = new();

    public string? Error { get; private set; }

    public class InputModel
    {
        [Required, StringLength(300)]
        public string Title { get; set; } = string.Empty;

        [Required, StringLength(8000)]
        public string Body { get; set; } = string.Empty;

        public NoticePriority Priority { get; set; } = NoticePriority.Normal;
        public NoticeAudience Audience { get; set; } = NoticeAudience.Members;
    }

    public void OnGet() { }

    public async Task<IActionResult> OnPostAsync()
    {
        if (!ModelState.IsValid)
            return Page();

        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        try
        {
            await notices.PublishAsync(
                new PublishNoticeRequest(Form.Title, Form.Body, Form.Priority, Form.Audience, null), userId);
            return RedirectToPage("Index");
        }
        catch (Exception ex) when (ex is DomainException or ForbiddenException)
        {
            Error = ex.Message;
            return Page();
        }
    }
}
