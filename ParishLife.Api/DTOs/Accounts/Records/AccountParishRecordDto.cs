// Purpose: one parish's official Person record for the signed-in account's own linked person, with that person's own correction requests.
// Main members: ParishId, ParishName, PersonId, GivenName, FamilyName, BirthDate, Contact and Corrections (newest first).

using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Accounts.Records;

public class AccountParishRecordDto
{
    public string ParishId { get; set; } = string.Empty;

    public string ParishName { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public string GivenName { get; set; } = string.Empty;

    public string FamilyName { get; set; } = string.Empty;

    public DateOnly? BirthDate { get; set; } = null;

    public string? Contact { get; set; } = null;

    public Versioned<ProfileCorrectionDto>[] Corrections { get; set; } = Array.Empty<Versioned<ProfileCorrectionDto>>();
}
