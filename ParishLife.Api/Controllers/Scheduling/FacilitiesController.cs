// Purpose: exposes scoped room/space configuration, serviceability and redacted availability.
// Main functions: Create, Update, Get, List, Status, Availability delegate dependency, allocation and access checks to FacilityService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Scheduling;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Scheduling;

namespace ParishLife.Api.Controllers.Scheduling;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/facilities")]
public class FacilitiesController(FacilityService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<FacilityDto>> Create(Guid parishId, SaveFacilityDto request, CancellationToken ct) => Ok(await service.SaveAsync(Guard.Id(parishId), null, request, ct));
    [HttpPut("{facilityId:guid}")]
    public async Task<ActionResult<FacilityDto>> Update(Guid parishId, Guid facilityId, SaveFacilityDto request, CancellationToken ct) => Ok(await service.SaveAsync(Guard.Id(parishId), Guard.Id(facilityId), request, ct));
    [HttpGet("{facilityId:guid}")]
    public async Task<ActionResult<Versioned<FacilityDto>>> Get(Guid parishId, Guid facilityId, CancellationToken ct) => Ok(await service.GetAsync(Guard.Id(parishId), Guard.Id(facilityId), ct));
    [HttpGet]
    public async Task<ActionResult<Page<Versioned<FacilityDto>>>> List(Guid parishId, CancellationToken ct, int size = 25, string? cursor = null) => Ok(await service.ListAsync(Guard.Id(parishId), size, cursor, ct));
    [HttpPost("{facilityId:guid}/status")]
    public async Task<ActionResult<FacilityDto>> Status(Guid parishId, Guid facilityId, FacilityStatusDto request, CancellationToken ct) => Ok(await service.SetStatusAsync(Guard.Id(parishId), Guard.Id(facilityId), request, ct));
    [HttpGet("{facilityId:guid}/availability")]
    public async Task<ActionResult<IReadOnlyList<AvailabilitySlotDto>>> Availability(Guid parishId, Guid facilityId, DateTimeOffset start, DateTimeOffset end, CancellationToken ct)
        => Ok(await service.AvailabilityAsync(Guard.Id(parishId), Guard.Id(facilityId), start, end, ct));
}
