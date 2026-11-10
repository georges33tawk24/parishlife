// Purpose: exposes office people search and audited people exports over HTTP.
// Main functions: Search, PreviewExport and Export delegate rules to PeopleDirectoryService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.People;

namespace ParishLife.Api.Controllers.People;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/people")]
public class PeopleDirectoryController(PeopleDirectoryService service) : ControllerBase
{
    [HttpGet("search")]
    public async Task<ActionResult<IReadOnlyList<PersonSearchResultDto>>> Search(Guid parishId, string q, CancellationToken ct, bool includeArchived = false, int size = 25)
        => Ok(await service.SearchAsync(Guard.Id(parishId), q, includeArchived, size, ct));

    [HttpGet("export/preview")]
    public async Task<ActionResult<PeopleExportPreviewDto>> PreviewExport(Guid parishId, [FromQuery] string[] columns, CancellationToken ct, bool includeArchived = false)
        => Ok(await service.PreviewExportAsync(Guard.Id(parishId), columns, includeArchived, ct));

    [HttpPost("export")]
    public async Task<IActionResult> Export(Guid parishId, PeopleExportDto request, CancellationToken ct)
        => File(System.Text.Encoding.UTF8.GetPreamble().Concat(System.Text.Encoding.UTF8.GetBytes(await service.ExportAsync(Guard.Id(parishId), request, ct))).ToArray(),
            "text/csv", "people.csv");
}
