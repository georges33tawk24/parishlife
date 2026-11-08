// Purpose: represents record reads business state and rules.
// Main members: the declared named values or shared rule constants.

using ParishLife.Api.Interfaces.Repositories.Common;

namespace ParishLife.Api.Models;

public static class RecordReads
{
    public static async Task<IReadOnlyList<Versioned<T>>> CollectAsync<T>(this IRecordTransactions records, RecordScope scope, string type, CancellationToken ct, int maximum = 5000, params RecordCondition[] conditions)
    {
        var result = new List<Versioned<T>>();
        string? cursor = null;
        do
        {
            var page = await records.PageAsync<T>(scope, type, 100, cursor, ct, conditions);
            result.AddRange(page.Items);
            cursor = page.ContinuationToken;
            if (result.Count > maximum)
                throw new ParishLife.Api.Models.DomainException("operation_too_large", "Use a bounded background job for this dataset.");
        }
        while (cursor is not null);
        return result;
    }
}
