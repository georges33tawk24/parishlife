// Purpose: represents person output data, including the optional Arabic name twins, rite and register status.
// Main functions: From.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.People;

public class PersonDto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    public string? GivenNameAr { get; set; } = null;

    public string? FamilyNameAr { get; set; } = null;

    public DateOnly? BirthDate { get; set; }

    public string? Contact { get; set; }

    public string? Rite { get; set; } = null;

    public string? RegisterStatus { get; set; } = null;

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public string? UpdatedBy { get; set; } = null;

    public DateTimeOffset? UpdatedAt { get; set; } = null;

    public bool Archived { get; set; }

    public static PersonDto From(Person value) => new PersonDto
    {
        Id = value.Id,
        ParishId = value.ParishId,
        GivenName = value.GivenName,
        FamilyName = value.FamilyName,
        GivenNameAr = value.GivenNameAr,
        FamilyNameAr = value.FamilyNameAr,
        BirthDate = value.BirthDate,
        Contact = value.Contact,
        Rite = value.Rite,
        RegisterStatus = value.RegisterStatus,
        CreatedBy = value.CreatedBy,
        CreatedAt = value.CreatedAt,
        UpdatedBy = value.UpdatedBy,
        UpdatedAt = value.UpdatedAt,
        Archived = value.Archived
    };
}
