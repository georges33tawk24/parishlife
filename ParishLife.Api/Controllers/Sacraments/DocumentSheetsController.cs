// Purpose: exposes authority-supplied certificate templates and the printable certificate sheet over HTTP.
// Main functions: Propose, Approve, Templates and Sheet delegate rules to DocumentSheetService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Sacraments;

namespace ParishLife.Api.Controllers.Sacraments;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}")]
public class DocumentSheetsController(DocumentSheetService service) : ControllerBase
{
    [HttpPut("document-templates")]
    public async Task<ActionResult<DocumentTemplateDto>> Propose(Guid parishId, SaveDocumentTemplateDto request, CancellationToken ct)
        => Ok(await service.ProposeAsync(Guard.Id(parishId), request, ct));

    [HttpPost("document-templates/{kind}/{language}/approve")]
    public async Task<ActionResult<DocumentTemplateDto>> Approve(Guid parishId, string kind, string language, CancellationToken ct)
        => Ok(await service.ApproveAsync(Guard.Id(parishId), Guard.Text(kind, "Kind", 40), Guard.Text(language, "Language", 2), ct));

    [HttpGet("document-templates")]
    public async Task<ActionResult<IReadOnlyList<DocumentTemplateDto>>> Templates(Guid parishId, CancellationToken ct)
        => Ok(await service.TemplatesAsync(Guard.Id(parishId), ct));

    // Served as an attachment so it is printed or saved, not rendered inside the app's origin.
    [HttpGet("certificates/{certificateId:guid}/sheet")]
    public async Task<IActionResult> Sheet(Guid parishId, Guid certificateId, CancellationToken ct)
        => File(System.Text.Encoding.UTF8.GetBytes(await service.RenderAsync(Guard.Id(parishId), Guard.Id(certificateId), ct)), "text/html; charset=utf-8", "certificate.html");
}
