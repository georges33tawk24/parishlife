// Purpose: handles the ArchdiocesesController HTTP routes through backend services and explicit DTO projections.
// Main functions: the declared routes apply authentication, bind validated DTOs, and return authorized results.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;

namespace ParishLife.Api.Controllers.Organizations;

[Authorize, ApiController, Route("api/archdioceses")]
public sealed class ArchdiocesesController(ParishService service) : ControllerBase
{
    [HttpGet("{organizationId:guid}")]
    public async Task<IActionResult> Get(Guid organizationId, CancellationToken ct)
    {
        var row = await service.GetArchdioceseAsync(Guard.Id(organizationId), ct);
        return Ok(new Versioned<ArchdioceseDto> { Value = ArchdioceseDto.From(row.Value), Version = row.Version });
    }

    [HttpPost]
    public async Task<IActionResult> Register(RegisterArchdioceseDto request, CancellationToken ct) => Ok(ArchdioceseDto.From(await service.RegisterArchdioceseAsync(request, ct)));
    [HttpPost("{organizationId:guid}/verify")]
    public async Task<IActionResult> Verify(Guid organizationId, VerifyParishDto request, CancellationToken ct) => Ok(ArchdioceseDto.From(await service.VerifyArchdioceseAsync(Guard.Id(organizationId), request, ct)));
}
