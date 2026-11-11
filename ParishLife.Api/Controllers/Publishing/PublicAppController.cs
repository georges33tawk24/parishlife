// Purpose: serves the public web-app install manifest and the offline-reading/cache-safety policy (X11).
// Main functions: Manifest (application/manifest+json, only from operator configuration) and OfflinePolicy.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Publishing;
using ParishLife.Api.Middleware;
using ParishLife.Api.Services.Publishing;

namespace ParishLife.Api.Controllers.Publishing;

[AllowAnonymous, ApiController, Route("api/public/app")]
public class PublicAppController(PublicAppService service) : ControllerBase
{
    [HttpGet("manifest"), PublicCache(3600), Produces("application/manifest+json")]
    public ActionResult<WebAppManifestDto> Manifest() => Ok(service.Manifest());

    [HttpGet("offline-policy"), PublicCache(3600)]
    public ActionResult<OfflinePolicyDto> OfflinePolicy() => Ok(service.OfflinePolicy());
}
