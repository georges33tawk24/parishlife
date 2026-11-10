// Purpose: represents an office-managed household: a shared contact/residence unit that grants no guardianship, finance or record access.
// Main members: Id, ParishId, Name, Address, Phone, ContactPersonId, EnvelopeId, Status and change facts.

namespace ParishLife.Api.Models;

public class Household
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    // Shared default address; members may keep their own instead.
    public string? Address { get; set; } = null;

    public string? Phone { get; set; } = null;

    // The household contact label carries no authority over other adults.
    public string? ContactPersonId { get; set; } = null;

    // Optional manual envelope identifier, unique within the parish.
    public string? EnvelopeId { get; set; } = null;

    // Active or Dissolved.
    public string Status { get; set; } = "Active";

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
