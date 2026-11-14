// Purpose: submits one conditional personal display/language/appearance/details update and rejects unrelated identity or official-record fields.
// Main members: OperationId binds an unchanged retry; Version is the current account/profile fence; editable fields have bounded values.
// The optional personal details replace the stored ones as sent (omitted or blank clears one); Arabic twins are never derived from the Latin text.

using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts.Profile;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class UpdateAccountProfileDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(200)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [StringLength(200)]
    public string DisplayName { get; set; } = string.Empty;

    [RegularExpression("^(en|fr|ar)$")]
    public string? PreferredLanguage { get; set; }

    [Required]
    public AccountAppearanceDto Appearance { get; set; } = new();

    [StringLength(100)]
    public string? GivenName { get; set; } = null;

    [StringLength(100)]
    public string? GivenNameAr { get; set; } = null;

    [StringLength(100)]
    public string? FamilyName { get; set; } = null;

    [StringLength(100)]
    public string? FamilyNameAr { get; set; } = null;

    [StringLength(200)]
    public string? Town { get; set; } = null;

    [StringLength(200)]
    public string? TownAr { get; set; } = null;

    [StringLength(300)]
    public string? Address { get; set; } = null;

    [StringLength(200)]
    public string? Occupation { get; set; } = null;

    [StringLength(1000)]
    public string? About { get; set; } = null;
}
