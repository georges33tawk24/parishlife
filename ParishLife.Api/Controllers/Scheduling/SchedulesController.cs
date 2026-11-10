// Purpose: exposes the member's own schedule and a priest's duty schedule as JSON or a one-off iCalendar download.
// Main functions: Mine and Priest delegate to ScheduleService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api")]
public class SchedulesController(ScheduleService service) : ControllerBase
{
    [HttpGet("me/schedule")]
    public async Task<IActionResult> Mine(DateTimeOffset from, DateTimeOffset to, CancellationToken ct, string? format = null)
        => Render(await service.MineAsync(from, to, ct), format, "my-schedule.ics");

    [HttpGet("parishes/{parishId:guid}/clergy/schedule")]
    public async Task<IActionResult> Priest(Guid parishId, DateTimeOffset from, DateTimeOffset to, CancellationToken ct, string? format = null)
        => Render(await service.PriestAsync(Guard.Id(parishId), from, to, ct), format, "priest-schedule.ics");

    private IActionResult Render(IReadOnlyList<ScheduleItemDto> items, string? format, string name)
        => format == "ics" ? File(System.Text.Encoding.UTF8.GetBytes(service.ToICalendar(items)), "text/calendar", name) : Ok(items);
}
