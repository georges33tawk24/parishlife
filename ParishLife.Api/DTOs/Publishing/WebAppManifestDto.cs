// Purpose: the public web-app install manifest, using the W3C manifest member names, built only from validated operator configuration.
// Main members: name, short_name, description, start_url, display, theme_color, background_color and icons.

using System.Text.Json.Serialization;

namespace ParishLife.Api.DTOs.Publishing;

public class WebAppManifestDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("short_name")]
    public string ShortName { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; set; } = null;

    [JsonPropertyName("start_url")]
    public string StartUrl { get; set; } = "/";

    [JsonPropertyName("display")]
    public string Display { get; set; } = "browser";

    [JsonPropertyName("theme_color")]
    public string? ThemeColor { get; set; } = null;

    [JsonPropertyName("background_color")]
    public string? BackgroundColor { get; set; } = null;

    [JsonPropertyName("icons")]
    public WebAppIconDto[] Icons { get; set; } = Array.Empty<WebAppIconDto>();
}
