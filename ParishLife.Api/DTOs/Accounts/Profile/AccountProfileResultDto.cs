// Purpose: reports the original profile operation separately from the currently authorized personal state.
// Main members: Status/AppliedAt describe the committed operation; RequestedValuesAreCurrent avoids implying a later change was overwritten by a retry.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Accounts.Profile;

public class AccountProfileResultDto
{
    public string OperationId { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public DateTimeOffset AppliedAt { get; set; }

    public bool RequestedValuesAreCurrent { get; set; }

    public Versioned<AccountProfileDto> Current { get; set; } = new();
}
