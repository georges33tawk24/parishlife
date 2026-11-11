// Purpose: fresh credential proof required before redirecting an MFA account holder to link an external provider.
// Main members: CurrentPassword and CurrentCode; neither enters operation metadata or the provider round trip.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Accounts;

public class LinkExternalLoginDto
{
    [Required, StringLength(200)]
    public string CurrentPassword { get; set; } = string.Empty;

    [StringLength(12, MinimumLength = 6)]
    public string? CurrentCode { get; set; }
}
