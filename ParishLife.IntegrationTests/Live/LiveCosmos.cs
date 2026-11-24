// Purpose: opt-in settings for the live Cosmos tests (owner decision Q26, 23 November 2026). They run only when
// PARISHLIFE_LIVE_COSMOS_DATABASE is set, and only against the separate empty test database ParishLifeTest; any other name, including the
// production database ParishLife, is refused before a client is created. Sign-in uses the developer's own Azure sign-in (az login / Visual
// Studio), never the hosted managed identity.
// Main members: TestDatabase, Requested, Database (guarded), Endpoint, Client.

using Azure.Identity;
using Microsoft.Azure.Cosmos;
using ParishLife.Api.Data.Cosmos;

namespace ParishLife.IntegrationTests.Live;

internal static class LiveCosmos
{
    public const string TestDatabase = "ParishLifeTest";
    public const string DatabaseVariable = "PARISHLIFE_LIVE_COSMOS_DATABASE";
    public const string EndpointVariable = "PARISHLIFE_LIVE_COSMOS_ENDPOINT";
    private const string DefaultEndpoint = "https://cosmos-parishlife.documents.azure.com:443/";

    public static string? Requested => Environment.GetEnvironmentVariable(DatabaseVariable);

    // Refuses every database except the test one, so a live run can never write to real parish data.
    public static string Guard(string? requested) => requested == TestDatabase
        ? requested
        : throw new InvalidOperationException($"Live tests run only against the Cosmos database '{TestDatabase}', not '{requested}'.");

    public static string Database => Guard(Requested);

    public static string Endpoint => Environment.GetEnvironmentVariable(EndpointVariable) is { Length: > 0 } endpoint ? endpoint : DefaultEndpoint;

    public static CosmosClient Client() => new(Endpoint,
        new DefaultAzureCredential(new DefaultAzureCredentialOptions { ExcludeManagedIdentityCredential = true, ExcludeWorkloadIdentityCredential = true }),
        new CosmosClientOptions
        {
            ApplicationName = "ParishLife-live-tests",
            ConsistencyLevel = ConsistencyLevel.Strong,
            UseSystemTextJsonSerializerWithOptions = JsonDefaults.Options
        });
}
