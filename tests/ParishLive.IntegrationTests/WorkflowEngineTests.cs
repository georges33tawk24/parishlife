using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Data;
using Xunit;

namespace ParishLive.IntegrationTests;

/// <summary>
/// The configurable workflow engine (adopted from the ParishLife reference): the reservation approval
/// chain is stored as data, so it constrains the path and enforces "reject/return needs a reason"
/// without hard-coded logic.
/// </summary>
public class WorkflowEngineTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;
    public WorkflowEngineTests(TestAppFactory factory) => _factory = factory;

    private AppDbContext Context()
    {
        _ = _factory.Services; // ensure host started + seeded
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_factory.Connection).Options;
        return new AppDbContext(options, StaticTenantContext.None); // workflow tables aren't tenant-filtered
    }

    [Fact]
    public async Task Default_reservation_workflow_is_seeded_as_data()
    {
        await using var db = Context();
        var def = await db.WorkflowDefinitions.SingleAsync(d => d.Code == "reservation-default");
        var states = await db.WorkflowStates.Where(s => s.WorkflowDefinitionId == def.Id).ToListAsync();

        Assert.Contains(states, s => s.Code == "Submitted" && s.IsInitial);
        Assert.Contains(states, s => s.Code == "Approved" && s.IsTerminal);
        Assert.Contains(states, s => s.Code == "Rejected" && s.IsTerminal);
    }

    [Fact]
    public async Task Reject_and_return_transitions_require_a_note_but_forward_does_not()
    {
        await using var db = Context();
        var reject = await db.WorkflowTransitions.FirstAsync(t => t.ActionCode == "Reject");
        var returnForCorrection = await db.WorkflowTransitions.FirstAsync(t => t.ActionCode == "ReturnForCorrection");
        var forward = await db.WorkflowTransitions.FirstAsync(t => t.ActionCode == "Forward");

        Assert.True(reject.RequiresNote);
        Assert.True(returnForCorrection.RequiresNote);
        Assert.False(forward.RequiresNote);
    }

    [Fact]
    public async Task Workflow_does_not_allow_skipping_secretary_review()
    {
        await using var db = Context();
        var def = await db.WorkflowDefinitions.SingleAsync(d => d.Code == "reservation-default");
        var submitted = await db.WorkflowStates.FirstAsync(s => s.WorkflowDefinitionId == def.Id && s.Code == "Submitted");
        var approved = await db.WorkflowStates.FirstAsync(s => s.WorkflowDefinitionId == def.Id && s.Code == "Approved");

        var canSkip = await db.WorkflowTransitions.AnyAsync(t => t.FromStateId == submitted.Id && t.ToStateId == approved.Id);

        Assert.False(canSkip); // Submitted -> Approved is not a defined transition
    }
}
