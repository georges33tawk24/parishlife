// Purpose: the shared factory for the equality filter services pass to IRecordTransactions.PageAsync, replacing the private
// `Equal(path, value)` copies in service files (Agent 02 handoff 5).
// Main function: Equal.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.Common;

public static class RecordConditions
{
    public static RecordCondition Equal(string path, object? value) => new() { Path = path, Comparison = "eq", Value = value };
}
