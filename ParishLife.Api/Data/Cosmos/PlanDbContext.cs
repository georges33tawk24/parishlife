// Purpose: Maps immutable plan catalogue records to the existing Cosmos Catalog container; performs no relational
// migrations.
// Main functions: OnModelCreating.

using Microsoft.EntityFrameworkCore;
using ParishLife.Api.Configuration;
using ParishLife.Api.Models;

namespace ParishLife.Api.Data.Cosmos;

public sealed class PlanDocument
{
    public string Id { get; set; } = string.Empty;
    public string PartitionKey { get; set; } = "plans";
    public int SchemaVersion { get; set; } = 1;
    public string Type { get; set; } = "plan";
    public string Fingerprint { get; set; } = string.Empty;
    public string PublishedBy { get; set; } = string.Empty;
    public PlanDefinition Plan { get; set; } = new();
}

public sealed class PlanDbContext(DbContextOptions<PlanDbContext> options) : DbContext(options)
{
    public DbSet<PlanDocument> Plans => Set<PlanDocument>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var plan = modelBuilder.Entity<PlanDocument>();
        plan.ToContainer(Containers.Catalog);
        plan.HasPartitionKey(p => p.PartitionKey);
        plan.HasKey(p => new { p.Id, p.PartitionKey });
        plan.HasNoDiscriminator();
        plan.Property(p => p.Id).ToJsonProperty("id");
        plan.Property(p => p.PartitionKey).ToJsonProperty("partitionKey");
        plan.Property(p => p.Type).ToJsonProperty("type");
        plan.Property(p => p.SchemaVersion).ToJsonProperty("schemaVersion");
        plan.Property(p => p.Fingerprint).ToJsonProperty("fingerprint");
        plan.Property(p => p.PublishedBy).ToJsonProperty("publishedBy");
        plan.OwnsOne(p => p.Plan, owned =>
        {
            owned.ToJsonProperty("data");
            owned.Property(p => p.Id).ToJsonProperty("id");
            owned.Property(p => p.Name).ToJsonProperty("name");
            owned.Property(p => p.Modules).ToJsonProperty("modules");
            owned.Property(p => p.TermMonths).ToJsonProperty("termMonths");
            owned.Property(p => p.PublishedAt).ToJsonProperty("publishedAt");
            owned.Property(p => p.Version).ToJsonProperty("version");
            owned.OwnsOne(p => p.Price, money =>
            {
                money.ToJsonProperty("price");
                money.Property(p => p.Amount).ToJsonProperty("amount");
                money.Property(p => p.Currency).ToJsonProperty("currency");
                money.Property(p => p.MinorUnits).ToJsonProperty("minorUnits");
            });
        });
    }
}
