// Purpose: inspects existing Cosmos, private Blob containers, and Key Vault metadata without changing Azure.
// Main functions: ProbeAsync, CheckAsync, CheckAzureAsync.

using Azure;
using Azure.Identity;
using Azure.Security.KeyVault.Keys;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Operations;

public sealed record InfrastructureReport(bool Ready, string Provider, DateTimeOffset CheckedAt, IReadOnlyDictionary<string, string> Checks);
public sealed class InfrastructureReadiness(CosmosClient? client, IOptions<CosmosOptions> cosmos, string? localPath, BlobServiceClient? blobs, KeyClient? keys, IOptions<BlobStorageOptions> storage, IOptions<Configuration.DataProtectionOptions> protection, IConfiguration configuration)
{
    private readonly SemaphoreSlim gate = new(1, 1);
    private InfrastructureReport? cached;
    public async Task<InfrastructureReport> ProbeAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            if (cached is { } previous && DateTimeOffset.UtcNow - previous.CheckedAt < TimeSpan.FromSeconds(30))
                return previous;
            if (localPath is not null)
                return cached = new(true, "LocalDevelopment", DateTimeOffset.UtcNow, new Dictionary<string, string> { ["Azure"] = "Not checked: explicitly using isolated local development storage." });
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(20));
            var checks = new Dictionary<string, string>();
            try
            {
                await CheckAzureAsync(checks, timeout.Token);
                checks["Telemetry"] = string.IsNullOrWhiteSpace(configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]) ? "Azure Monitor export is not configured in this process." : "Azure Monitor export configured; ingestion not verified by a metadata probe.";
                return cached = new(true, "Cosmos", DateTimeOffset.UtcNow, checks);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                checks["Failure"] = "dependency_timeout";
            }
            catch (CosmosException exception)
            {
                checks["Failure"] = "cosmos_http_" + (int)exception.StatusCode;
            }
            catch (RequestFailedException exception)
            {
                checks["Failure"] = "azure_http_" + exception.Status;
            }
            catch (AuthenticationFailedException)
            {
                checks["Failure"] = "azure_authentication_failed";
            }
            catch (DomainException exception)
            {
                checks["Failure"] = exception.Code;
            }

            return cached = new(false, "Cosmos", DateTimeOffset.UtcNow, checks);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<IReadOnlyDictionary<string, string>> CheckAsync(CancellationToken cancellationToken)
    {
        var report = await ProbeAsync(cancellationToken);
        return new Dictionary<string, string>(report.Checks)
        {
            ["Ready"] = report.Ready.ToString(),
            ["Provider"] = report.Provider,
            ["CheckedAt"] = report.CheckedAt.ToString("O")
        };
    }

    private async Task CheckAzureAsync(Dictionary<string, string> checks, CancellationToken cancellationToken)
    {
        var account = await client!.ReadAccountAsync().WaitAsync(cancellationToken);
        if (account.Consistency.DefaultConsistencyLevel != ConsistencyLevel.Strong)
            throw new DomainException("consistency_contract_mismatch", "The current persistence contract requires Strong consistency.", FailureKind.Unavailable);
        checks["CosmosConsistency"] = "Strong";
        foreach (var name in new[]
        {
            Containers.Accounts,
            Containers.LoginAliases,
            Containers.TenantControl,
            Containers.Billing,
            Containers.Catalog
        }

        )
        {
            var response = await client.GetContainer(cosmos.Value.Database, name).ReadContainerAsync(cancellationToken: cancellationToken);
            if (response.Resource.PartitionKeyPath != "/partitionKey" || response.Resource.DefaultTimeToLive is not null)
                throw new DomainException("container_contract_mismatch", "A Cosmos partition/TTL contract does not match the application.", FailureKind.Unavailable);
            checks["Cosmos:" + name] = "Metadata readable; /partitionKey and disabled TTL verified.";
            if (name == Containers.Accounts)
            {
                Configuration.CosmosIndexContract.ValidateAccounts(response.Resource);
                checks["Cosmos:Accounts:Indexes"] = "Required personal-workspace query paths readable; metadata checks do not inspect protected content or test live queries.";
            }
            if (name == Containers.TenantControl)
            {
                Configuration.CosmosIndexContract.ValidateTenant(response.Resource);
                checks["Cosmos:TenantControl:Indexes"] = "Required query index policy paths readable; transformation completion and live query behavior are not tested by this metadata probe.";
            }
        }

        var ring = new BlobUriBuilder(new Uri(protection.Value.BlobUri));
        foreach (var container in new[]
        {
            ring.BlobContainerName,
            storage.Value.EvidenceContainer
        }.Distinct(StringComparer.Ordinal))
        {
            var properties = await blobs!.GetBlobContainerClient(container).GetPropertiesAsync(cancellationToken: cancellationToken);
            if (properties.Value.PublicAccess != PublicAccessType.None)
                throw new DomainException("public_storage_container", "Required storage containers must be private.", FailureKind.Unavailable);
            checks["Blob:" + container] = "Private container metadata readable; write access not tested.";
        }

        var keyName = new Uri(protection.Value.KeyIdentifier).Segments[^1].Trim('/');
        var key = await keys!.GetKeyAsync(keyName, cancellationToken: cancellationToken);
        if (key.Value.Properties.Enabled == false)
            throw new DomainException("key_disabled", "The Data Protection key is disabled.", FailureKind.Unavailable);
        checks["KeyVault"] = "Enabled key metadata readable; wrap/unwrap and key-ring persistence require separate round-trip verification.";
    }
}
