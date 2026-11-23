// Purpose: represents parish input/output data.
// Main functions: From.

using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.DTOs.Organizations;

public class ParishDto
{
    public string Id { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Locality { get; set; } = string.Empty;

    public string Contact { get; set; } = string.Empty;

    public string? DeclaredArchdiocese { get; set; }

    public ParishStatus Status { get; set; }

    public string OwnerAccountId { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? RegisteredArchdioceseId { get; set; }

    public string? RegisteredAssociationId { get; set; }

    public string? JurisdictionArchdioceseId { get; set; }

    public static ParishDto From(Parish value) => new ParishDto
    {
        Id = value.Id,
        Name = value.Name,
        Locality = value.Locality,
        Contact = value.Contact,
        DeclaredArchdiocese = value.DeclaredArchdiocese,
        Status = value.Status,
        OwnerAccountId = value.OwnerAccountId,
        CreatedAt = value.CreatedAt,
        RegisteredArchdioceseId = value.RegisteredArchdioceseId,
        RegisteredAssociationId = value.RegisteredAssociationId,
        JurisdictionArchdioceseId = value.JurisdictionArchdioceseId
    };
}
