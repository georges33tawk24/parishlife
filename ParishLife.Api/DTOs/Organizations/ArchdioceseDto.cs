// Purpose: represents archdiocese input/output data.
// Main functions: From.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Organizations;

public class ArchdioceseDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Locality { get; set; } = string.Empty;

    public string OwnerAccountId { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public bool Verified { get; set; }

    public static ArchdioceseDto From(Archdiocese value) => new ArchdioceseDto
    {
        Id = value.Id,
        Name = value.Name,
        Locality = value.Locality,
        OwnerAccountId = value.OwnerAccountId,
        CreatedAt = value.CreatedAt,
        Verified = value.Verified
    };
}
