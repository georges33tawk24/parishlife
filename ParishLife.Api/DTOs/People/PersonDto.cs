// Purpose: represents person input/output data.
// Main functions: From.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.People;

public class PersonDto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; }

    public string? Contact { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }

    public bool Archived { get; set; }

    public static PersonDto From(Person value) => new PersonDto
    {
        Id = value.Id,
        ParishId = value.ParishId,
        GivenName = value.GivenName,
        FamilyName = value.FamilyName,
        BirthDate = value.BirthDate,
        Contact = value.Contact,
        CreatedBy = value.CreatedBy,
        CreatedAt = value.CreatedAt,
        Archived = value.Archived
    };
}
