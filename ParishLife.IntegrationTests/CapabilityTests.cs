// Purpose: verifies the platform capability report (W06) states what this deployment really has.
// Main test: delivery, payment and signature integrations are reported unavailable and local storage is named as such.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.Services.Operations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class CapabilityTests
{
    [Fact]
    public async Task Capabilities_never_claim_integrations_that_are_not_configured()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var list = f.Services.GetRequiredService<CapabilityService>().List().ToDictionary(c => c.Name);
        Assert.All(new[] { "Email delivery", "SMS delivery", "Online payments", "Electronic signatures", "Retention and deletion" }, n => Assert.False(list[n].Available));
        Assert.Equal("Local development folder.", list["Private file storage"].Behaviour);
    }
}
