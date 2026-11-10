// Purpose: exposes exact-message reports and exceptional exact-message review over HTTP; rules live in MessageReviewService.
// Main functions: Report, OwnReports, Reports, CloseReport, RequestReview, List, Decide, ReadMessage and Close.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Communications;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Communications;

namespace ParishLife.Api.Controllers.Communications;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class MessageReviewController(MessageReviewService service) : ControllerBase
{
    [HttpPost("inbox/{conversationId:guid}/messages/{messageId:guid}/reports")]
    public async Task<ActionResult<MessageReportDto>> Report(Guid parishId, Guid conversationId, Guid messageId, ReportMessageDto request, CancellationToken ct)
        => Ok(await service.ReportAsync(Guard.Id(parishId), Guard.Id(conversationId), Guard.Id(messageId), request, ct));

    [HttpGet("inbox/reports/mine")]
    public async Task<ActionResult<IReadOnlyList<MessageReportDto>>> OwnReports(Guid parishId, CancellationToken ct)
        => Ok(await service.OwnReportsAsync(Guard.Id(parishId), ct));

    [HttpGet("message-reports")]
    public async Task<ActionResult<IReadOnlyList<Versioned<MessageReportDto>>>> Reports(Guid parishId, CancellationToken ct)
        => Ok(await service.ReportsAsync(Guard.Id(parishId), ct));

    [HttpPost("message-reports/{reportId:guid}/close")]
    public async Task<ActionResult<MessageReportDto>> CloseReport(Guid parishId, Guid reportId, CloseMessageReviewDto request, CancellationToken ct)
        => Ok(await service.CloseReportAsync(Guard.Id(parishId), Guard.Id(reportId), request, ct));

    [HttpPost("message-reviews")]
    public async Task<ActionResult<MessageReviewDto>> RequestReview(Guid parishId, RequestMessageReviewDto request, CancellationToken ct)
        => Ok(await service.RequestAsync(Guard.Id(parishId), request, ct));

    [HttpGet("message-reviews")]
    public async Task<ActionResult<IReadOnlyList<Versioned<MessageReviewDto>>>> List(Guid parishId, CancellationToken ct)
        => Ok(await service.ListAsync(Guard.Id(parishId), ct));

    [HttpPost("message-reviews/{reviewId:guid}/decision")]
    public async Task<ActionResult<MessageReviewDto>> Decide(Guid parishId, Guid reviewId, MessageReviewDecisionDto request, CancellationToken ct)
        => Ok(await service.DecideAsync(Guard.Id(parishId), Guard.Id(reviewId), request, ct));

    [HttpGet("message-reviews/{reviewId:guid}/message")]
    public async Task<ActionResult<ReviewedMessageDto>> ReadMessage(Guid parishId, Guid reviewId, CancellationToken ct)
        => Ok(await service.ReadMessageAsync(Guard.Id(parishId), Guard.Id(reviewId), ct));

    [HttpPost("message-reviews/{reviewId:guid}/close")]
    public async Task<ActionResult<MessageReviewDto>> Close(Guid parishId, Guid reviewId, CloseMessageReviewDto request, CancellationToken ct)
        => Ok(await service.CloseAsync(Guard.Id(parishId), Guard.Id(reviewId), request, ct));
}
