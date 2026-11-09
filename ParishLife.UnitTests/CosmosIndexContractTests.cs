// Purpose: checks that deployment index validation rejects missing/overridden query paths while accepting compatible existing policies.
// Main tests: default and explicit policy compatibility, missing calendar ranges, precise exclusions and disabled indexing fail safely.

using Microsoft.Azure.Cosmos;
using ParishLife.Api.Configuration;
using ParishLife.Api.Models;
using Xunit;

namespace ParishLife.Tests;

public class CosmosIndexContractTests
{
    [Fact]
    public void Default_automatic_policy_supports_the_required_query_paths()
    {
        var container = new ContainerProperties("TenantControl", "/partitionKey");
        container.IndexingPolicy.IncludedPaths.Clear();
        container.IndexingPolicy.IncludedPaths.Add(new IncludedPath { Path = "/*" });
        container.IndexingPolicy.ExcludedPaths.Clear();
        CosmosIndexContract.ValidateTenant(container);
    }
    [Fact]
    public void Explicit_policy_preserves_private_unindexed_fields_and_indexes_only_required_paths()
    {
        var container = Explicit();
        CosmosIndexContract.ValidateTenant(container);
        container.IndexingPolicy.IncludedPaths.Remove(container.IndexingPolicy.IncludedPaths.Single(item => item.Path == "/data/startsAt/?"));
        Assert.Equal("calendar_index_contract_mismatch", Assert.Throws<DomainException>(() => CosmosIndexContract.ValidateTenant(container)).Code);
    }
    [Fact]
    public void A_more_precise_exclusion_overrides_a_broad_inclusion()
    {
        var container = new ContainerProperties("TenantControl", "/partitionKey");
        container.IndexingPolicy.IncludedPaths.Clear();
        container.IndexingPolicy.IncludedPaths.Add(new IncludedPath { Path = "/*" });
        container.IndexingPolicy.ExcludedPaths.Add(new ExcludedPath { Path = "/data/endsAt/?" });
        Assert.Throws<DomainException>(() => CosmosIndexContract.ValidateTenant(container));
    }
    [Fact]
    public void Disabled_or_nonautomatic_indexing_is_never_reported_compatible()
    {
        var container = Explicit();
        container.IndexingPolicy.Automatic = false;
        Assert.Throws<DomainException>(() => CosmosIndexContract.ValidateTenant(container));
        container.IndexingPolicy.Automatic = true;
        container.IndexingPolicy.IndexingMode = IndexingMode.None;
        Assert.Throws<DomainException>(() => CosmosIndexContract.ValidateTenant(container));
    }
    [Theory]
    [InlineData("/data/meetingId/?")]
    [InlineData("/data/joinedAt/?")]
    [InlineData("/data/personId/?")]
    [InlineData("/data/participantKind/?")]
    public void Missing_meeting_or_attendance_query_paths_are_rejected(string path)
    {
        var container = Explicit();
        container.IndexingPolicy.IncludedPaths.Remove(container.IndexingPolicy.IncludedPaths.Single(item => item.Path == path));
        Assert.Throws<DomainException>(() => CosmosIndexContract.ValidateTenant(container));
    }
    [Theory]
    [InlineData("/data/kind/?")]
    [InlineData("/data/status/?")]
    [InlineData("/data/itemId/?")]
    public void Account_workspaces_require_indexed_metadata_while_private_content_remains_excluded(string missing)
    {
        var container = new ContainerProperties("Accounts", "/partitionKey");
        container.IndexingPolicy.IncludedPaths.Clear();
        container.IndexingPolicy.ExcludedPaths.Clear();
        container.IndexingPolicy.ExcludedPaths.Add(new ExcludedPath { Path = "/*" });
        foreach (var path in CosmosIndexContract.RequiredAccountPaths)
            container.IndexingPolicy.IncludedPaths.Add(new IncludedPath { Path = path });
        CosmosIndexContract.ValidateAccounts(container);
        container.IndexingPolicy.IncludedPaths.Remove(container.IndexingPolicy.IncludedPaths.Single(item => item.Path == missing));
        Assert.Equal("account_index_contract_mismatch", Assert.Throws<DomainException>(() => CosmosIndexContract.ValidateAccounts(container)).Code);
        container.IndexingPolicy.IncludedPaths.Clear();
        container.IndexingPolicy.ExcludedPaths.Clear();
        container.IndexingPolicy.IncludedPaths.Add(new IncludedPath { Path = "/*" });
        CosmosIndexContract.ValidateAccounts(container);
        container.IndexingPolicy.ExcludedPaths.Add(new ExcludedPath { Path = missing });
        Assert.Throws<DomainException>(() => CosmosIndexContract.ValidateAccounts(container));
    }

    private static ContainerProperties Explicit()
    {
        var container = new ContainerProperties("TenantControl", "/partitionKey");
        container.IndexingPolicy.IncludedPaths.Clear();
        container.IndexingPolicy.ExcludedPaths.Clear();
        container.IndexingPolicy.ExcludedPaths.Add(new ExcludedPath { Path = "/*" });
        foreach (var path in CosmosIndexContract.RequiredTenantPaths)
            container.IndexingPolicy.IncludedPaths.Add(new IncludedPath { Path = path });
        return container;
    }
}
