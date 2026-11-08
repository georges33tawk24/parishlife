// Purpose: stores durable billing-to-coverage activation work and its processing lease.
// Main members: Id, Coverage, RecordedBy, CreatedAt, Status, LeaseOwner, LeaseUntil, and related workflow details.

namespace ParishLife.Api.Models;

public class ActivationWork
{
    public string Id { get; set; } = string.Empty;

    public Coverage Coverage { get; set; } = new();

    public string RecordedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string Status { get; set; } = "Pending";

    public string? LeaseOwner { get; set; } = null;

    public DateTimeOffset? LeaseUntil { get; set; } = null;

    public string? LastErrorCode { get; set; } = null;
}
