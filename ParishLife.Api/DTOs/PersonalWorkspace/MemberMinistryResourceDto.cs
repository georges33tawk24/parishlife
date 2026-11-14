// Purpose: returns one active ministry stock item to a current member of that ministry, without its storage location.
// Main members: Id, MinistryId, MinistryName, Name, Total, OnLoan, Available and UpdatedAt; no account identifiers are exposed.

namespace ParishLife.Api.DTOs.PersonalWorkspace;

public class MemberMinistryResourceDto
{
    public string Id { get; set; } = string.Empty;
    public string MinistryId { get; set; } = string.Empty;
    public string MinistryName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Total { get; set; }
    public int OnLoan { get; set; }
    public int Available { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
