// Purpose: delivers one-use contact-ownership codes (confirming a registered email, changing the sign-in email) by email through
// Resend (ResendEmailSender), in English and Arabic. Acceptance by Resend is not proof of receipt.
// Main members: Configured, SendAsync (true only when Resend accepted it), Message (the subject and bodies for a purpose).
// The code is never logged or stored by this class.

using System.Net;
using ParishLife.Api.Interfaces.Services.Accounts;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Services.Accounts;

public class ResendContactCodeDelivery(ResendEmailSender sender) : IContactCodeDelivery
{
    public bool Configured => sender.Configured;

    public Task<bool> SendAsync(string email, string code, string purpose, CancellationToken ct)
    {
        var (subject, text, html) = Message(code, purpose);
        return sender.SendAsync(email, subject, text, html, ct);
    }

    // One email in both languages, English first: the code is the only variable part. Nothing else about the account is included.
    internal static (string Subject, string Text, string Html) Message(string code, string purpose)
    {
        var change = purpose == "ChangeEmail";
        var subject = change ? "Confirm your new ParishLife email · تأكيد بريدك الجديد في ParishLife"
            : "Your ParishLife confirmation code · رمز التأكيد في ParishLife";
        var en = change ? "Use this code to confirm the new email address for your ParishLife account:"
            : "Use this code to confirm your email address on ParishLife:";
        var ar = change ? "استخدم هذا الرمز لتأكيد البريد الإلكتروني الجديد لحسابك في ParishLife:"
            : "استخدم هذا الرمز لتأكيد بريدك الإلكتروني في ParishLife:";
        const string expiresEn = "It expires in 15 minutes. If you did not ask for it, you can ignore this email.";
        const string expiresAr = "تنتهي صلاحيته بعد ١٥ دقيقة. إذا لم تطلبه، يمكنك تجاهل هذه الرسالة.";
        var text = $"{en}\n\n{code}\n\n{expiresEn}\n\n{ar}\n\n{code}\n\n{expiresAr}\n\nParishLife · https://parish-life.org";
        var safe = WebUtility.HtmlEncode(code);
        var html = $"""
            <div style="font-family:Arial,sans-serif;color:#1C2433;max-width:520px">
              <p>{WebUtility.HtmlEncode(en)}</p>
              <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{safe}</p>
              <p style="color:#4A5568">{WebUtility.HtmlEncode(expiresEn)}</p>
              <hr style="border:none;border-top:1px solid #E2DCD0">
              <div dir="rtl" lang="ar">
                <p>{WebUtility.HtmlEncode(ar)}</p>
                <p style="font-size:28px;font-weight:bold;letter-spacing:4px" dir="ltr">{safe}</p>
                <p style="color:#4A5568">{WebUtility.HtmlEncode(expiresAr)}</p>
              </div>
              <p style="color:#4A5568">ParishLife · <a href="https://parish-life.org">parish-life.org</a></p>
            </div>
            """;
        return (subject, text, html);
    }
}
