// Purpose: stores a parish-owned person separately from the global login account.
// Main members: Id, ParishId, GivenName, FamilyName, BirthDate, Contact, CreatedBy, and related workflow details.

namespace ParishLife.Api.Models;

public class Person
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; }

    public string? Contact { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public bool Archived { get; set; } = false;
}
