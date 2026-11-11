// Purpose: exposes signer setup, the bishop's electronic-signature arrangement, certificate electronic authorization, staff signature
// reads/revocation, and the anonymous verification of a printed code.
// Main functions: Profile, SaveProfile, Arrangement, SetArrangement, CertificatePreview, AuthorizeCertificate, Signature and Revoke delegate to
// DocumentSignatureService/CertificateService; PublicDocumentVerificationController.Verify serves code holders with rate limiting.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using ParishLife.Api.DTOs.Documents;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Documents;
using ParishLife.Api.Services.Sacraments;

namespace ParishLife.Api.Controllers.Documents;

[Authorize, ApiController]
public class DocumentSignaturesController(DocumentSignatureService service, CertificateService certificates) : ControllerBase
{
    [HttpGet("api/me/signer-profile")]
    public async Task<ActionResult<SignerProfileDto>> Profile(CancellationToken ct)
        => Ok(await service.ProfileAsync(ct));

    [HttpPut("api/me/signer-profile")]
    public async Task<ActionResult<Versioned<SignerProfileDto>>> SaveProfile(SaveSignerProfileDto request, CancellationToken ct)
        => Ok(await service.SaveProfileAsync(request, ct));

    [HttpGet("api/archdioceses/{archdioceseId:guid}/signature-arrangement")]
    public async Task<ActionResult<SignatureArrangementStateDto>> Arrangement(Guid archdioceseId, CancellationToken ct)
        => Ok(await service.ArrangementAsync(Guard.Id(archdioceseId), ct));

    [HttpPut("api/archdioceses/{archdioceseId:guid}/signature-arrangement")]
    public async Task<ActionResult<SignatureArrangementStateDto>> SetArrangement(Guid archdioceseId, SignatureArrangementDto request, CancellationToken ct)
        => Ok(await service.SetArrangementAsync(Guard.Id(archdioceseId), request, ct));

    [HttpGet("api/parishes/{parishId:guid}/certificates/{certificateId:guid}/authorization-preview")]
    public async Task<ActionResult<AuthorizationPreviewDto>> CertificatePreview(Guid parishId, Guid certificateId, CancellationToken ct)
        => Ok(await certificates.AuthorizationPreviewAsync(Guard.Id(parishId), Guard.Id(certificateId), ct));

    [HttpPost("api/parishes/{parishId:guid}/certificates/{certificateId:guid}/authorization")]
    public async Task<ActionResult<CertificateDto>> AuthorizeCertificate(Guid parishId, Guid certificateId, AuthorizeDocumentDto request, CancellationToken ct)
        => Ok(await certificates.AuthorizeAsync(Guard.Id(parishId), Guard.Id(certificateId), request, ct));

    [HttpGet("api/parishes/{parishId:guid}/document-signatures/{code}")]
    public async Task<ActionResult<Versioned<DocumentSignatureDto>>> Signature(Guid parishId, string code, CancellationToken ct)
        => Ok(await service.GetAsync(Guard.Id(parishId), code, ct));

    [HttpPost("api/parishes/{parishId:guid}/document-signatures/{code}/revoke")]
    public async Task<ActionResult<DocumentSignatureDto>> Revoke(Guid parishId, string code, RevokeSignatureDto request, CancellationToken ct)
        => Ok(await service.RevokeAsync(Guard.Id(parishId), code, request, ct));
}

[AllowAnonymous, ApiController, EnableRateLimiting("authentication"), Route("api/public/document-verifications")]
public class PublicDocumentVerificationController(DocumentSignatureService service) : ControllerBase
{
    [HttpGet("{code}")]
    public async Task<ActionResult<DocumentVerificationDto>> Verify(string code, CancellationToken ct)
        => Ok(await service.VerifyAsync(code, ct));
}
