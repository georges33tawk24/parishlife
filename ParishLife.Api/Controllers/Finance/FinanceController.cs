// Purpose: exposes parish funds, campaigns, counting sessions, posted gifts, pledges, statements, expenses and fund balances over HTTP.
// Main functions: CreateFund, UpdateFund, Funds, CreateCampaign, UpdateCampaign, Campaigns, Sessions, OpenSession, SaveLines, Verify, Post, Session, Contributions, Correct,
// CreatePledge, Allocate, Pledges, Statement, MyGiving, SaveExpense, UpdateExpense, ExpenseAction, Expenses and Balances.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Finance;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Finance;

namespace ParishLife.Api.Controllers.Finance;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/finance")]
public class FinanceController(GivingService giving, ExpenseService expenses) : ControllerBase
{
    [HttpPost("funds")]
    public async Task<ActionResult<FundDto>> CreateFund(Guid parishId, SaveFundDto request, CancellationToken ct) => Ok(await giving.CreateFundAsync(Guard.Id(parishId), request, ct));

    [HttpPut("funds/{fundId:guid}")]
    public async Task<ActionResult<FundDto>> UpdateFund(Guid parishId, Guid fundId, SaveFundDto request, CancellationToken ct)
        => Ok(await giving.UpdateFundAsync(Guard.Id(parishId), Guard.Id(fundId), request, ct));

    [HttpGet("funds")]
    public async Task<ActionResult<IReadOnlyList<FundDto>>> Funds(Guid parishId, CancellationToken ct) => Ok(await giving.FundsAsync(Guard.Id(parishId), ct));

    [HttpPost("campaigns")]
    public async Task<ActionResult<CampaignDto>> CreateCampaign(Guid parishId, SaveCampaignDto request, CancellationToken ct) => Ok(await giving.CreateCampaignAsync(Guard.Id(parishId), request, ct));

    [HttpPut("campaigns/{campaignId:guid}")]
    public async Task<ActionResult<CampaignDto>> UpdateCampaign(Guid parishId, Guid campaignId, SaveCampaignDto request, CancellationToken ct)
        => Ok(await giving.UpdateCampaignAsync(Guard.Id(parishId), Guard.Id(campaignId), request, ct));

    [HttpGet("campaigns")]
    public async Task<ActionResult<IReadOnlyList<CampaignDto>>> Campaigns(Guid parishId, CancellationToken ct) => Ok(await giving.CampaignsAsync(Guard.Id(parishId), ct));

    [HttpGet("sessions")]
    public async Task<ActionResult<IReadOnlyList<Versioned<CountSessionDto>>>> Sessions(Guid parishId, CancellationToken ct, string? status = null)
        => Ok(await giving.SessionsAsync(Guard.Id(parishId), status, ct));

    [HttpPost("sessions")]
    public async Task<ActionResult<CountSessionDto>> OpenSession(Guid parishId, OpenSessionDto request, CancellationToken ct) => Ok(await giving.OpenSessionAsync(Guard.Id(parishId), request, ct));

    [HttpPut("sessions/{sessionId:guid}/lines")]
    public async Task<ActionResult<CountSessionDto>> SaveLines(Guid parishId, Guid sessionId, SaveLinesDto request, CancellationToken ct)
        => Ok(await giving.SaveLinesAsync(Guard.Id(parishId), Guard.Id(sessionId), request, ct));

    [HttpPost("sessions/{sessionId:guid}/verify")]
    public async Task<ActionResult<CountSessionDto>> Verify(Guid parishId, Guid sessionId, VerifySessionDto request, CancellationToken ct)
        => Ok(await giving.VerifyAsync(Guard.Id(parishId), Guard.Id(sessionId), request, ct));

    [HttpPost("sessions/{sessionId:guid}/post")]
    public async Task<ActionResult<CountSessionDto>> Post(Guid parishId, Guid sessionId, PostSessionDto request, CancellationToken ct)
        => Ok(await giving.PostAsync(Guard.Id(parishId), Guard.Id(sessionId), request, ct));

    [HttpGet("sessions/{sessionId:guid}")]
    public async Task<ActionResult<Versioned<CountSessionDto>>> Session(Guid parishId, Guid sessionId, CancellationToken ct)
        => Ok(await giving.SessionAsync(Guard.Id(parishId), Guard.Id(sessionId), ct));

    [HttpGet("contributions")]
    public async Task<ActionResult<IReadOnlyList<Versioned<ContributionDto>>>> Contributions(Guid parishId, CancellationToken ct, Guid? fundId = null, Guid? campaignId = null)
        => Ok(await giving.ContributionsAsync(Guard.Id(parishId), fundId is { } f ? Guard.Id(f) : null, campaignId is { } c ? Guard.Id(c) : null, ct));

    [HttpPost("contributions/{contributionId:guid}/corrections")]
    public async Task<ActionResult<ContributionDto>> Correct(Guid parishId, Guid contributionId, CorrectContributionDto request, CancellationToken ct)
        => Ok(await giving.CorrectAsync(Guard.Id(parishId), Guard.Id(contributionId), request, ct));

    [HttpPost("pledges")]
    public async Task<ActionResult<PledgeDto>> CreatePledge(Guid parishId, SavePledgeDto request, CancellationToken ct) => Ok(await giving.CreatePledgeAsync(Guard.Id(parishId), request, ct));

    [HttpPost("pledges/{pledgeId:guid}/allocations")]
    public async Task<ActionResult<PledgeDto>> Allocate(Guid parishId, Guid pledgeId, AllocatePledgeDto request, CancellationToken ct)
        => Ok(await giving.AllocateAsync(Guard.Id(parishId), Guard.Id(pledgeId), request, ct));

    [HttpGet("pledges")]
    public async Task<ActionResult<IReadOnlyList<PledgeDto>>> Pledges(Guid parishId, CancellationToken ct) => Ok(await giving.PledgesAsync(Guard.Id(parishId), ct));

    [HttpGet("statements")]
    public async Task<ActionResult<GivingStatementDto>> Statement(Guid parishId, int year, CancellationToken ct, Guid? personId = null, Guid? householdId = null)
        => Ok(await giving.StatementAsync(Guard.Id(parishId), personId is { } p ? Guard.Id(p) : null, householdId is { } h ? Guard.Id(h) : null, year, ct));

    [HttpGet("giving/mine")]
    public async Task<ActionResult<GivingStatementDto>> MyGiving(Guid parishId, int year, CancellationToken ct) => Ok(await giving.OwnGivingAsync(Guard.Id(parishId), year, ct));

    [HttpPost("expenses")]
    public async Task<ActionResult<ExpenseDto>> SaveExpense(Guid parishId, SaveExpenseDto request, CancellationToken ct) => Ok(await expenses.SaveAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("expenses/{expenseId:guid}")]
    public async Task<ActionResult<ExpenseDto>> UpdateExpense(Guid parishId, Guid expenseId, SaveExpenseDto request, CancellationToken ct)
        => Ok(await expenses.SaveAsync(Guard.Id(parishId), Guard.Id(expenseId), request, ct));

    [HttpPost("expenses/{expenseId:guid}/actions")]
    public async Task<ActionResult<ExpenseDto>> ExpenseAction(Guid parishId, Guid expenseId, ExpenseActionDto request, CancellationToken ct)
        => Ok(await expenses.ActAsync(Guard.Id(parishId), Guard.Id(expenseId), request, ct));

    [HttpGet("expenses")]
    public async Task<ActionResult<IReadOnlyList<Versioned<ExpenseDto>>>> Expenses(Guid parishId, CancellationToken ct, string? status = null)
        => Ok(await expenses.ListAsync(Guard.Id(parishId), status, ct));

    [HttpGet("balances")]
    public async Task<ActionResult<IReadOnlyList<FundBalanceDto>>> Balances(Guid parishId, CancellationToken ct) => Ok(await expenses.BalancesAsync(Guard.Id(parishId), ct));
}
