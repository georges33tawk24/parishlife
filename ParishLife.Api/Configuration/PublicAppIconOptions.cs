// Purpose: one operator-supplied install icon for the web-app manifest (a site path or https URL to an approved image).
// Main members: Src, Sizes, Type and Purpose.

namespace ParishLife.Api.Configuration;

public class PublicAppIconOptions
{
    public string Src { get; set; } = string.Empty;

    public string Sizes { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;

    public string? Purpose { get; set; } = null;
}
