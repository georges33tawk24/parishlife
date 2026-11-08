// Purpose: represents record condition business state and rules.
// Main members: Path, Comparison, Value.

namespace ParishLife.Api.Models;

public class RecordCondition
{
    public string Path { get; set; } = string.Empty;

    public string Comparison { get; set; } = string.Empty;

    public object? Value { get; set; }
}
