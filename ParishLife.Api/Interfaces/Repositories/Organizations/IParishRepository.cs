// Purpose: Declares the IParishRepository boundary used by backend services without exposing provider
// implementation details.
// Main functions: GetAsync, GetGrantAsync, RegisterAsync, VerifyAsync, GrantAsync, RevokeAsync, GetCoveragesAsync,
// ActivateCoverageAsync, RegisterArchdioceseAsync, GetArchdioceseAsync, VerifyArchdioceseAsync,
// ProposeAssociationAsync, GetAssociationAsync, DecideAssociationAsync, EndAssociationAsync, GetPayerScheduleAsync.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.Organizations;

public interface IParishRepository
{
    Task<Versioned<Parish>?> GetAsync(string parishId, CancellationToken ct);
    Task<AccessGrant?> GetGrantAsync(string parishId, string accountId, CancellationToken ct);
    Task<Parish> RegisterAsync(Parish parish, AccessGrant ownerGrant, Operation operation, CancellationToken ct);
    Task<Parish> VerifyAsync(string parishId, string version, string evidence, Operation operation, CancellationToken ct);
    Task GrantAsync(string parishId, string version, AccessGrant grant, Operation operation, CancellationToken ct);
    Task RevokeAsync(string parishId, string version, string accountId, string reason, Operation operation, CancellationToken ct);
    Task<IReadOnlyList<Coverage>> GetCoveragesAsync(string parishId, CancellationToken ct);
    Task ActivateCoverageAsync(Coverage coverage, Operation operation, CancellationToken ct);
    Task<Archdiocese> RegisterArchdioceseAsync(Archdiocese organization, Operation operation, CancellationToken ct);
    Task<Versioned<Archdiocese>?> GetArchdioceseAsync(string id, CancellationToken ct);
    Task<Archdiocese> VerifyArchdioceseAsync(string id, string version, string evidence, Operation operation, CancellationToken ct);
    Task<AssociationRequest> ProposeAssociationAsync(string parishId, string version, string archdioceseId, Operation operation, CancellationToken ct);
    Task<Versioned<AssociationRequest>?> GetAssociationAsync(string parishId, string requestId, CancellationToken ct);
    Task<AssociationRequest> DecideAssociationAsync(string parishId, string requestId, string version, bool accept, Operation operation, CancellationToken ct);
    Task<Parish> EndAssociationAsync(string parishId, string version, string reason, Operation operation, CancellationToken ct);
    Task<Versioned<PayerSchedule>?> GetPayerScheduleAsync(string parishId, CancellationToken ct);
}
