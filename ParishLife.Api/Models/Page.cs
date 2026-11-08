// Purpose: returns a bounded result page and its protected continuation token.
// Main members: Items, ContinuationToken.

namespace ParishLife.Api.Models;

public class Page<T>
{
    public IReadOnlyList<T> Items { get; set; } = Array.Empty<T>();

    public string? ContinuationToken { get; set; }
}
