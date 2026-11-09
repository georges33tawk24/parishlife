// Purpose: submits one conditional personal display/language/appearance update and rejects unrelated identity or official-record fields.
// Main members: OperationId binds an unchanged retry; Version is the current account/profile fence; editable fields have bounded values.

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
}
