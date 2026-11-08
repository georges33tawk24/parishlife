// Purpose: pairs a stored value with the concurrency version required for conditional changes.
// Main members: Value, Version.

namespace ParishLife.Api.Models;

public class Versioned<T>
{
    public T Value { get; set; } = default!;

    public string Version { get; set; } = string.Empty;
}
