// Purpose: reports whether one optional external sign-in provider is configured in this deployment.
// Main members: Provider and Available (false means hide it from the primary sign-in flow).

namespace ParishLife.Api.DTOs.Accounts;

public class ExternalProviderCapabilityDto
{
    public string Provider { get; set; } = string.Empty;

    public bool Available { get; set; }
}
