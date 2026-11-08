// Purpose: Defines Cosmos, Azure identity, Data Protection, and existing-container configuration values.
// Main members: AzureOptions, Containers, CosmosOptions, DataProtectionOptions.

namespace ParishLife.Api.Configuration;

public sealed class CosmosOptions
{
    public string Endpoint { get; set; } = "";
    public string Database { get; set; } = "ParishLife";
    // An emulator key is allowed only in Development; never used in Production.
    public string? EmulatorKey { get; set; }
}

public sealed class AzureOptions
{
    public string? ManagedIdentityClientId { get; set; }
}

public sealed class DataProtectionOptions
{
    public string ApplicationName { get; set; } = "ParishLife.Production";
    public string BlobUri { get; set; } = "";
    public string KeyIdentifier { get; set; } = "";
}

public static class Containers
{
    public const string Accounts = "Accounts";
    public const string LoginAliases = "LoginAliases";
    public const string TenantControl = "TenantControl";
    public const string Billing = "Billing";
    public const string Catalog = "Catalog";
}
