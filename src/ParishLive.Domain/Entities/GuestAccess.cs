using ParishLive.Domain.Common;
namespace ParishLive.Domain.Entities;
public sealed class GuestAccess : TenantEntity
{
    public Guid CaseId { get; set; }
    public string TokenHash { get; set; } = "";
    public DateTimeOffset ExpiresAtUtc { get; set; }
    public bool Revoked { get; set; }
    public string? AssociatedUserId { get; set; }
    public string? AssociationEvidenceReference { get; set; }
    public string? AssociatedByUserId { get; set; }
}
