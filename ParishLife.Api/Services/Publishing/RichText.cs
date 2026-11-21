// Purpose: the server-side half of the rich-text allow-list (frontend/src/lib/rich-text.js safeRichText), applied when an announcement or a
// website section is saved, so stored text is safe even for a reader that skips the browser sanitizer.
// Main function: Sanitize. Text that does not look like markup (the browser's own test) is returned unchanged. Markup is rebuilt from
// scratch: text is decoded and re-encoded, the allowed tags (b, strong, u, i, em, ul, ol, li, p, br; div becomes p) are written without
// attributes, and a link keeps only an absolute http(s) href with target _blank and rel noopener noreferrer. Everything else (script,
// style, img, iframe, event handlers, javascript: links, comments) is dropped, keeping its text. Nothing from the input is copied verbatim.

using System.Net;
using System.Text;
using System.Text.RegularExpressions;

namespace ParishLife.Api.Services.Publishing;

public static partial class RichText
{
    private static readonly HashSet<string> Allowed = new(StringComparer.OrdinalIgnoreCase) { "b", "strong", "u", "i", "em", "ul", "ol", "li", "p", "div", "br", "a" };

    public static string Sanitize(string text)
    {
        if (!LooksLikeMarkup().IsMatch(text))
            return text;
        var output = new StringBuilder(text.Length);
        var links = new Stack<bool>(); // whether each open <a> was written, so its </a> is written only then
        var position = 0;
        foreach (Match tag in Tag().Matches(text))
        {
            output.Append(Encode(text[position..tag.Index]));
            position = tag.Index + tag.Length;
            var name = tag.Groups["name"].Value;
            var closing = tag.Groups["close"].Success;
            if (!Allowed.Contains(name))
                continue;
            var element = name.Equals("div", StringComparison.OrdinalIgnoreCase) ? "p" : name.ToLowerInvariant();
            if (element == "br")
                output.Append(closing ? string.Empty : "<br>");
            else if (element != "a")
                output.Append(closing ? $"</{element}>" : $"<{element}>");
            else if (closing)
                output.Append(links.TryPop(out var written) && written ? "</a>" : string.Empty);
            else
            {
                var href = Href(tag.Groups["attributes"].Value);
                links.Push(href is not null);
                if (href is not null)
                    output.Append("<a href=\"").Append(WebUtility.HtmlEncode(href)).Append("\" target=\"_blank\" rel=\"noopener noreferrer\">");
            }
        }
        output.Append(Encode(text[position..]));
        return output.ToString();
    }

    private static string? Href(string attributes)
    {
        var match = HrefAttribute().Match(attributes);
        if (!match.Success)
            return null;
        var value = WebUtility.HtmlDecode(match.Groups["double"].Success ? match.Groups["double"].Value
            : match.Groups["single"].Success ? match.Groups["single"].Value : match.Groups["bare"].Value).Trim();
        return Uri.TryCreate(value, UriKind.Absolute, out var uri) && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp)
            ? uri.AbsoluteUri : null;
    }

    // Decoding first keeps an already-encoded "&amp;" from becoming "&amp;amp;"; a stray "<" or ">" is encoded like any other text.
    private static string Encode(string text) => WebUtility.HtmlEncode(WebUtility.HtmlDecode(text));

    // The same test as the browser's News view: something that starts like an element.
    [GeneratedRegex(@"<[a-z]", RegexOptions.IgnoreCase | RegexOptions.NonBacktracking)]
    private static partial Regex LooksLikeMarkup();

    // A start or end tag, or a comment/doctype/processing instruction (name group empty, so it is dropped). Linear: no nested quantifiers.
    [GeneratedRegex(@"<(?<close>/)?(?<name>[a-zA-Z][a-zA-Z0-9]*)(?<attributes>[^<>]*)>|<[!?][^<>]*>", RegexOptions.NonBacktracking)]
    private static partial Regex Tag();

    [GeneratedRegex("""\bhref\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\s"'>]+))""", RegexOptions.IgnoreCase | RegexOptions.NonBacktracking)]
    private static partial Regex HrefAttribute();
}
