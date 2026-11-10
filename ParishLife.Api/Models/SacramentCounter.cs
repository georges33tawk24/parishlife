// Purpose: holds the next official number for one register scope; numbers are never reused.
// Main members: Scope and Next.

namespace ParishLife.Api.Models;

public class SacramentCounter
{
    public string Scope { get; set; } = string.Empty;

    public int Next { get; set; }
}
