// Purpose: one install icon in the public web-app manifest.
// Main members: src, sizes, type and purpose.

using System.Text.Json.Serialization;

namespace ParishLife.Api.DTOs.Publishing;

public class WebAppIconDto
{
    [JsonPropertyName("src")]
    public string Src { get; set; } = string.Empty;

    [JsonPropertyName("sizes")]
    public string Sizes { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("purpose")]
    public string? Purpose { get; set; } = null;
}
