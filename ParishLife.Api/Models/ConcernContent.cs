// Purpose: holds a concern's protected summary and details before encryption.
// Main members: Summary and Details.

namespace ParishLife.Api.Models;

public class ConcernContent
{
    public string Summary { get; set; } = string.Empty;

    public string Details { get; set; } = string.Empty;
}
