// Purpose: tests factual jurisdiction proposal/decision boundaries without preloading church or commercial data.
// Main tests: Only_the_actual_bishop_can_decide_with_fresh_proofs_and_stale_versions_change_nothing; Proposal_requires_its_actual_verified_representative.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class ParishJurisdictionTests
{
    [Fact]
    public async Task Only_the_actual_bishop_can_decide_with_fresh_proofs_and_stale_versions_change_nothing()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var organization = await fixture.AppointedOrganizationAsync();
        fixture.As(fixture.FirstAdmin);
        var parishes = fixture.Services.GetRequiredService<ParishService>();
        var repository = fixture.Services.GetRequiredService<IParishRepository>();
        var service = fixture.Services.GetRequiredService<ParishJurisdictionService>();
        var parish = await parishes.RegisterAsync(new RegisterParishDto
        {
            OperationId = Guid.NewGuid(),
            Name = "Isolated jurisdiction parish",
            Locality = "Fixture",
            Contact = "Fixture representative"
        }, default);
        await parishes.VerifyAsync(parish.Id, new VerifyParishDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await repository.GetAsync(parish.Id, default))!.Version,
            EvidenceReference = "isolated representative verification"
        }, default);
        var proposal = await service.ProposeAsync(parish.Id, new ProposeParishJurisdictionDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await repository.GetAsync(parish.Id, default))!.Version,
            ArchdioceseId = Guid.Parse(organization),
            Reason = "Isolated jurisdiction proposal",
            EvidenceReference = "isolated jurisdiction proof"
        }, default);
        var row = await service.GetAsync(parish.Id, proposal.Id, default);
        var decision = new DecideParishJurisdictionDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            Accept = true,
            Reason = "Isolated jurisdiction acceptance",
            CurrentPassword = "isolated-fixture-long-password",
            CurrentCode = RealIdentityWorkflowTests.FixtureCode()
        };
        await Assert.ThrowsAsync<DomainException>(() => service.DecideAsync(parish.Id, proposal.Id, decision, default));
        fixture.As(fixture.Other);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(parish.Id, proposal.Id, default))).Kind);
        fixture.As(fixture.Nominee);
        var before = (await repository.GetAsync(parish.Id, default))!;
        decision.Version = "stale";
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.DecideAsync(parish.Id, proposal.Id, decision, default))).Code);
        Assert.Equal(before.Version, (await repository.GetAsync(parish.Id, default))!.Version);
        Assert.Null((await repository.GetAsync(parish.Id, default))!.Value.JurisdictionArchdioceseId);
        decision.Version = row.Version;
        await service.DecideAsync(parish.Id, proposal.Id, decision, default);
        var linked = (await repository.GetAsync(parish.Id, default))!.Value;
        Assert.Equal(organization, linked.JurisdictionArchdioceseId);
        Assert.Equal(proposal.Id, linked.JurisdictionProposalId);
        Assert.Null(linked.RegisteredArchdioceseId);
        Assert.Equal(proposal.Id, (await service.DecideAsync(parish.Id, proposal.Id, decision, default)).Id);
        decision.Accept = false;
        Assert.Equal("operation_reused", (await Assert.ThrowsAsync<DomainException>(() => service.DecideAsync(parish.Id, proposal.Id, decision, default))).Code);
    }

    [Fact]
    public async Task Proposal_requires_its_actual_verified_representative()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var organization = await fixture.AppointedOrganizationAsync();
        fixture.As(fixture.FirstAdmin);
        var service = fixture.Services.GetRequiredService<ParishJurisdictionService>();
        var repository = fixture.Services.GetRequiredService<IParishRepository>();
        var parish = await fixture.Services.GetRequiredService<ParishService>().RegisterAsync(new RegisterParishDto
        {
            OperationId = Guid.NewGuid(),
            Name = "Isolated pending parish",
            Locality = "Fixture",
            Contact = "Fixture contact"
        }, default);
        var request = new ProposeParishJurisdictionDto
        {
            OperationId = Guid.NewGuid(),
            Version = (await repository.GetAsync(parish.Id, default))!.Version,
            ArchdioceseId = Guid.Parse(organization),
            Reason = "Isolated setup proposal",
            EvidenceReference = "isolated evidence"
        };
        Assert.Equal("jurisdiction_review_required", (await Assert.ThrowsAsync<DomainException>(() => service.ProposeAsync(parish.Id, request, default))).Code);
        fixture.As(fixture.Other);
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => service.ProposeAsync(parish.Id, request, default))).Kind);
    }
}
