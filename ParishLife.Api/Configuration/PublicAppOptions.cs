// Purpose: operator-supplied web-app install metadata (configuration section "PublicApp"). Nothing has a default name or branding: without a
// Name the install manifest reports that it is not configured.
// Main members: Name, ShortName, Description, StartUrl, Display, ThemeColor, BackgroundColor and Icons.

namespace ParishLife.Api.Configuration;

public class PublicAppOptions
{
    public string Name { get; set; } = string.Empty;

    public string ShortName { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string StartUrl { get; set; } = "/";

    public string Display { get; set; } = "browser";

    public string? ThemeColor { get; set; } = null;

    public string? BackgroundColor { get; set; } = null;

    public PublicAppIconOptions[] Icons { get; set; } = Array.Empty<PublicAppIconOptions>();
}
