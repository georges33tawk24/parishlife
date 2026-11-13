// Purpose: validates the optional Arabic version (title and body) stored next to a non-Arabic main text of a broadcast, template or notice.
// Main function: Pair returns both trimmed texts or neither; it never translates or copies the main text, and refuses an Arabic version
// when the main text is already Arabic.

using ParishLife.Api.Models;

namespace ParishLife.Api.Services.Communications;

internal static class ArabicVersion
{
    internal static (string? Title, string? Body) Pair(string? title, string? body, string language, int bodyMaximum)
    {
        var hasTitle = !string.IsNullOrWhiteSpace(title);
        var hasBody = !string.IsNullOrWhiteSpace(body);
        if (!hasTitle && !hasBody)
            return (null, null);
        if (language == "ar")
            throw new DomainException("invalid_input", "The main text is already Arabic; leave the Arabic version empty.");
        if (!hasTitle || !hasBody)
            throw new DomainException("invalid_input", "Give both the Arabic title and the Arabic text, or neither.");
        return (Guard.Text(title, "Arabic title", 300), Guard.Text(body, "Arabic text", bodyMaximum));
    }
}
