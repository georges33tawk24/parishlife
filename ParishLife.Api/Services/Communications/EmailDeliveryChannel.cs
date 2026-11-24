// Purpose: the email channel for notices and broadcasts, through Resend, only to a confirmed address and only if the person keeps email on.
// Main members: Name ("Email"), Configured, SendAsync and Compose (subject, text and HTML in the recipient's language, with the sign-in
// link and where to change these choices). A notice carries only its neutral title; a broadcast also carries its body.

using System.Net;
using ParishLife.Api.Interfaces.Services.Communications;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class EmailDeliveryChannel(ResendEmailSender sender) : IDeliveryChannel
{
    public string Name => "Email";

    public bool Configured => sender.Configured;

    public async Task<DeliveryOutcome> SendAsync(DeliveryTarget target, DeliveryMessage message, CancellationToken ct)
    {
        if (!Configured || !target.Preferences.Email || string.IsNullOrWhiteSpace(target.Email))
            return DeliveryOutcome.Skipped;
        var (subject, text, html) = Compose(message);
        return await sender.SendAsync(target.Email, subject, text, html, ct) ? DeliveryOutcome.Sent : DeliveryOutcome.Failed;
    }

    internal static (string Subject, string Text, string Html) Compose(DeliveryMessage message)
    {
        var ar = message.Language == "ar";
        var open = ar ? "افتح ParishLife" : "Open ParishLife";
        var change = ar ? "يمكنك تغيير طريقة تواصل ParishLife معك من «حسابي»." : "You can change how ParishLife contacts you under My account.";
        var subject = "ParishLife: " + message.Title;
        var text = string.Join("\n\n", new[] { message.Title, message.Body, $"{open}: {message.Link}", change }.Where(part => !string.IsNullOrWhiteSpace(part)));
        var body = string.IsNullOrWhiteSpace(message.Body) ? string.Empty
            : $"<p style=\"white-space:pre-line\">{WebUtility.HtmlEncode(message.Body)}</p>";
        var html = $"""
            <div dir="{(ar ? "rtl" : "ltr")}" lang="{(ar ? "ar" : "en")}" style="font-family:Arial,sans-serif;color:#1C2433;max-width:560px">
              <p style="font-size:18px;font-weight:bold">{WebUtility.HtmlEncode(message.Title)}</p>
              {body}
              <p><a href="{WebUtility.HtmlEncode(message.Link)}" style="color:#7A5A1E">{open}</a></p>
              <p style="color:#4A5568;font-size:13px">{WebUtility.HtmlEncode(change)}</p>
            </div>
            """;
        return (subject, text, html);
    }
}
