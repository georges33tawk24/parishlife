// Purpose: lets verified accounts discover their own staff invitations without searching another person's appointments.
// Main function: List returns a bounded safe DTO page; it does not confer authority or activate appointments.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Controllers.Accounts;

[Authorize, ApiController, Route("api/auth/staff-appointments")]
public class StaffAppointmentDirectoryController(StaffAppointmentService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<Page<Versioned<StaffAppointmentDto>>>> List(CancellationToken ct, int size = 25, string? cursor = null)
        => Ok(await service.OwnAsync(size, cursor, ct));
}
