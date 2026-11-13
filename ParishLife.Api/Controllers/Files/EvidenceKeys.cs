// Purpose: validates the optional checklist key sent with a multipart evidence upload (form fields bypass DTO validation).
// Main function: Checklist returns null for an empty key or the key when it has the checklist item key shape.

using System.Text.RegularExpressions;
using ParishLife.Api.Models;

namespace ParishLife.Api.Controllers.Files;

public static partial class EvidenceKeys
{
    public static string? Checklist(string? key)
    {
        if (string.IsNullOrWhiteSpace(key))
            return null;
        return KeyShape().IsMatch(key) ? key : throw new DomainException("invalid_input", "Use a checklist item key of this case.");
    }

    [GeneratedRegex("^[a-z0-9][a-z0-9-]{0,39}$")]
    private static partial Regex KeyShape();
}
