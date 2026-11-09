// Purpose: explicitly resets only personal appearance, retaining personal display text and language.
// Main members: OperationId supports unchanged retries; Version prevents replacing a newer profile or security state.

using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Accounts.Profile;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class ResetAccountAppearanceDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(200)]
    public string Version { get; set; } = string.Empty;
}
