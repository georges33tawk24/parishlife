namespace ParishLive.Domain.Entities;

/// <summary>Administrative metadata has its own access path and can exist before the first parish.</summary>
public sealed class AdministrativeRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid OperationId { get; set; }
    public string ActorUserId { get; set; } = "";
    public string Action { get; set; } = "";
    public Guid OrgId { get; set; }
    public Guid ParishId { get; set; }
    public string TargetUserId { get; set; } = "";
    public Guid TargetId { get; set; }
    public string AuthorityReference { get; set; } = "";
    public string PayloadHash { get; set; } = "";
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class AdministrativeChangeRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string SubmittedByUserId { get; set; } = "";
    public string PayloadJson { get; set; } = "{}";
    public string Status { get; set; } = "Pending";
    public string? ApprovedByUserId { get; set; }
    public Guid? AppointmentId { get; set; }
    public long Revision { get; set; } = 1;
}
