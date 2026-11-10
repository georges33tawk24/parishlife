// Purpose: returns a household with its members and effective addresses.
// Main members: Id, Name, Address, Phone, ContactPersonId, EnvelopeId, Status, Members, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.DTOs.People;

public class HouseholdDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Address { get; set; } = null;

    public string? Phone { get; set; } = null;

    public string? ContactPersonId { get; set; } = null;

    public string? EnvelopeId { get; set; } = null;

    public string Status { get; set; } = string.Empty;

    public HouseholdMemberDto[] Members { get; set; } = Array.Empty<HouseholdMemberDto>();

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
