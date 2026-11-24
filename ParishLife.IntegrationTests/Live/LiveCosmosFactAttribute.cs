// Purpose: marks a test that talks to the live Cosmos test database; it is skipped unless PARISHLIFE_LIVE_COSMOS_DATABASE is set, so ordinary
// test runs never touch the network.
// Main member: the constructor sets Skip with how to opt in.

using Xunit;

namespace ParishLife.IntegrationTests.Live;

public sealed class LiveCosmosFactAttribute : FactAttribute
{
    public LiveCosmosFactAttribute()
    {
        if (string.IsNullOrEmpty(LiveCosmos.Requested))
            Skip = $"Live Cosmos test: set {LiveCosmos.DatabaseVariable}={LiveCosmos.TestDatabase} and sign in with az login to run it.";
    }
}
