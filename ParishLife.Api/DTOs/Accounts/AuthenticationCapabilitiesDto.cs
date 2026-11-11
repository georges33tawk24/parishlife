// Purpose: public, honest summary of which authentication capabilities this deployment actually has configured.
// Main members: PasswordSignIn, Registration, Passkeys, ExternalProviders, Turnstile, ContactVerificationDelivery, ManualIdentityReview.

namespace ParishLife.Api.DTOs.Accounts;

public class AuthenticationCapabilitiesDto
{
    public bool PasswordSignIn { get; set; } = true;

    public bool Registration { get; set; } = true;

    public bool Passkeys { get; set; }

    public List<ExternalProviderCapabilityDto> ExternalProviders { get; set; } = [];

    public TurnstileCapabilityDto Turnstile { get; set; } = new();

    public string ContactVerificationDelivery { get; set; } = "NotConfigured";

    public bool ManualIdentityReview { get; set; } = true;
}
