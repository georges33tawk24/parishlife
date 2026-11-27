// Purpose: verifies free coverage (owner decision, 23 November 2026) through real local services and storage: only a ParishLife operator grants
// it, it unlocks exactly the chosen modules like paid coverage, it carries no invoice, and it cannot overlap other coverage.
// Main test: Only_an_operator_grants_free_coverage_and_it_unlocks_the_chosen_modules.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class FreeCoverageTests
{
    [Fact]
    public async Task Only_an_operator_grants_free_coverage_and_it_unlocks_the_chosen_modules()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await IndependentParishScenario.CreateAsync(f);
        var access = f.Services.GetRequiredService<IParishAccess>();
        GrantFreeCoverageDto Request() => new() { OperationId = Guid.NewGuid(), Modules = ["office"], StartsAt = f.Clock.Now, Reason = "Isolated first parish, free of charge" };

        // Module checks are made as the parish controller: an MFA operator passes every module check (owner decision, 27 November 2026).
        f.As(f.Other);
        await Assert.ThrowsAsync<DomainException>(() => access.RequireModuleAsync(s.Parish, "office", default));
        Assert.Equal("operator_required", (await Assert.ThrowsAsync<DomainException>(() => s.Billing.GrantFreeCoverageAsync(s.Parish, Request(), default))).Code);

        f.As(f.FirstAdmin);
        var request = Request();
        var coverage = await s.Billing.GrantFreeCoverageAsync(s.Parish, request, default);
        Assert.True(coverage.Complimentary);
        Assert.Equal((f.FirstAdmin, "", Coverage.NoEnd), (coverage.GrantedBy, coverage.InvoiceId, coverage.EndsAt));
        Assert.Equal(["core", "office"], coverage.Modules.Order().ToArray());
        // An exact retry replays; overlapping coverage is refused.
        Assert.Equal(coverage.Id, (await s.Billing.GrantFreeCoverageAsync(s.Parish, request, default)).Id);
        Assert.Equal("coverage_overlap", (await Assert.ThrowsAsync<DomainException>(() => s.Billing.GrantFreeCoverageAsync(s.Parish, Request(), default))).Code);

        f.As(f.Other);
        await access.RequireModuleAsync(s.Parish, "office", default);
        await access.RequireModuleAsync(s.Parish, "core", default);
        Assert.Equal("subscription_required", (await Assert.ThrowsAsync<DomainException>(() => access.RequireModuleAsync(s.Parish, "finance", default))).Code);

        // The parish sees it as free, granted by the operator, with no invoice.
        f.As(f.Other);
        var shown = Assert.Single(await s.Billing.GetCoverageAsync(s.Parish, default));
        Assert.Equal((true, f.FirstAdmin, ""), (shown.Complimentary, shown.GrantedBy, shown.InvoiceId));
    }
}
