// Purpose: verifies existing tenant and account index policies against implemented bounded queries without indexing protected content.
// Main functions: ValidateTenant, ValidateAccounts and Covers honor include/exclude precedence; no method changes Azure policy or data.

using Microsoft.Azure.Cosmos;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Configuration;

internal static class CosmosIndexContract
{
    internal static readonly string[] RequiredTenantPaths = ["/partitionKey/?", "/type/?", "/data/accountId/?", "/data/startsAt/?", "/data/endsAt/?",
        "/data/eventId/?", "/data/status/?", "/data/published/?", "/data/visibility/?",
        "/data/ministryId/?", "/data/kind/?", "/data/applicantAccountId/?", "/data/applicationId/?", "/data/publicListed/?", "/data/meetingId/?", "/data/joinedAt/?", "/data/personId/?", "/data/participantKind/?", "/data/registrationId/?", "/data/opportunityId/?", "/data/householdId/?", "/data/equipmentId/?", "/data/requestId/?", "/data/conversationId/?"];

    internal static readonly string[] RequiredAccountPaths = ["/partitionKey/?", "/type/?", "/data/kind/?", "/data/status/?", "/data/itemId/?"];

    internal static void ValidateTenant(ContainerProperties container)
        => Validate(container, RequiredTenantPaths, "calendar_index_contract_mismatch",
            "TenantControl needs the reviewed appointment/calendar/reservation/ministry index paths. Inspect the manual container contract before enabling these workflows.");

    internal static void ValidateAccounts(ContainerProperties container)
        => Validate(container, RequiredAccountPaths, "account_index_contract_mismatch",
            "Accounts needs the reviewed personal-workspace query index paths. Inspect existing metadata and the manual contract before enabling these workflows.");

    private static void Validate(ContainerProperties container, string[] required, string code, string message)
    {
        var policy = container.IndexingPolicy;
        if (policy.IndexingMode != IndexingMode.Consistent || !policy.Automatic || required.Any(path =>
            policy.IncludedPaths.Where(item => Covers(item.Path, path)).Select(item => Specificity(item.Path)).DefaultIfEmpty(-1).Max()
            <= policy.ExcludedPaths.Where(item => Covers(item.Path, path)).Select(item => Specificity(item.Path)).DefaultIfEmpty(-1).Max()))
            throw new DomainException(code, message, FailureKind.Unavailable);
    }
    private static int Specificity(string pattern) => pattern.EndsWith("/*", StringComparison.Ordinal) ? pattern.Length - 1 : pattern.Length;
    private static bool Covers(string pattern, string path) => pattern == path || pattern.EndsWith("/*", StringComparison.Ordinal)
        && path.StartsWith(pattern[..^1], StringComparison.Ordinal);
}
