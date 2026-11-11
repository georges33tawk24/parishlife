// Purpose: public, honest authentication capability endpoint (X13): what this deployment has actually configured.
// Main function: Get reports password/registration, passkeys, each optional external provider, Turnstile (public site key only)
// and whether a contact-code delivery provider exists; no secret or account data is returned.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Interfaces.Services.Accounts;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Controllers.Accounts;

[ApiController]
[Route("api/auth/capabilities")]
public class AuthenticationCapabilitiesController(ExternalSignInService external, IOptionsMonitor<TurnstileOptions> turnstile,
    IContactCodeDelivery delivery) : ControllerBase
{
    [AllowAnonymous, HttpGet]
    public async Task<ActionResult<AuthenticationCapabilitiesDto>> Get()
    {
        var providers = new List<ExternalProviderCapabilityDto>();
        foreach (var provider in ExternalProviderOptions.Providers.Keys)
            providers.Add(new ExternalProviderCapabilityDto { Provider = provider, Available = await external.AvailableAsync(provider) });
        var settings = turnstile.CurrentValue;
        return Ok(new AuthenticationCapabilitiesDto
        {
            Passkeys = true,
            ExternalProviders = providers,
            Turnstile = new TurnstileCapabilityDto { Enabled = settings.Enabled, SiteKey = settings.Enabled ? settings.SiteKey : null },
            ContactVerificationDelivery = delivery.Configured ? "ProviderConfigured" : "NotConfigured"
        });
    }
}
