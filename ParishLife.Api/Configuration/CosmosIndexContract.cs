// Purpose: verifies that existing TenantControl indexing can serve the implemented appointment/calendar/reservation/ministry queries.
// Main functions: ValidateTenant and Covers honor explicit include/exclude precedence; no method changes Azure policy or data.

using Microsoft.Azure.Cosmos;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Configuration;

internal static class CosmosIndexContract
{
    internal static readonly string[] RequiredTenantPaths = ["/partitionKey/?", "/type/?", "/data/accountId/?", "/data/startsAt/?", "/data/endsAt/?",
        "/data/eventId/?", "/data/status/?", "/data/published/?", "/data/visibility/?",
        "/data/ministryId/?", "/data/kind/?", "/data/applicantAccountId/?", "/data/applicationId/?", "/data/publicListed/?", "/data/meetingId/?", "/data/joinedAt/?", "/data/personId/?"];

    internal static void ValidateTenant(ContainerProperties container)
    {
        var policy = container.IndexingPolicy;
        if (policy.IndexingMode != IndexingMode.Consistent || !policy.Automatic || RequiredTenantPaths.Any(path =>
            policy.IncludedPaths.Where(item => Covers(item.Path, path)).Select(item => Specificity(item.Path)).DefaultIfEmpty(-1).Max()
            <= policy.ExcludedPaths.Where(item => Covers(item.Path, path)).Select(item => Specificity(item.Path)).DefaultIfEmpty(-1).Max()))
            throw new DomainException("calendar_index_contract_mismatch", "TenantControl needs the reviewed appointment/calendar/reservation/ministry index paths. Inspect the manual container contract before enabling these workflows.", FailureKind.Unavailable);
    }
    private static int Specificity(string pattern) => pattern.EndsWith("/*", StringComparison.Ordinal) ? pattern.Length - 1 : pattern.Length;
    private static bool Covers(string pattern, string path) => pattern == path || pattern.EndsWith("/*", StringComparison.Ordinal)
        && path.StartsWith(pattern[..^1], StringComparison.Ordinal);
}
