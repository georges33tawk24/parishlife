// Purpose: exposes ministry formation programs, enrollments, milestone progress, own progress and protected history over HTTP.
// Main functions: CreateProgram, ActProgram, GetProgram, ListPrograms, Enroll, Progress, EnrollmentAction, GetEnrollment, ListEnrollments,
// Mine and History delegate authorization, validation and state transitions to MinistryFormationService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Controllers.Ministries;

[Authorize, ApiController, Route("api/parishes/{parishId:guid}/ministries/{ministryId:guid}/formation")]
public class MinistryFormationController(MinistryFormationService service) : ControllerBase
{
    [HttpPost("programs")]
    public async Task<ActionResult<FormationProgramDto>> CreateProgram(Guid parishId, Guid ministryId, CreateFormationDto request, CancellationToken ct)
        => Ok(await service.CreateProgramAsync(Guard.Id(parishId), Guard.Id(ministryId), request, ct));

    [HttpGet("programs")]
    public async Task<ActionResult<Page<Versioned<FormationProgramDto>>>> ListPrograms(Guid parishId, Guid ministryId, CancellationToken ct,
        int size = 25, string? cursor = null)
        => Ok(await service.ListProgramsAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));

    [HttpGet("programs/{programId:guid}")]
    public async Task<ActionResult<Versioned<FormationProgramDto>>> GetProgram(Guid parishId, Guid ministryId, Guid programId, CancellationToken ct)
        => Ok(await service.GetProgramAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(programId), ct));

    [HttpPost("programs/{programId:guid}/actions")]
    public async Task<ActionResult<FormationProgramDto>> ActProgram(Guid parishId, Guid ministryId, Guid programId, FormationProgramActionDto request, CancellationToken ct)
        => Ok(await service.ActProgramAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(programId), request, ct));

    [HttpPost("programs/{programId:guid}/enrollments")]
    public async Task<ActionResult<FormationEnrollmentDto>> Enroll(Guid parishId, Guid ministryId, Guid programId, EnrollFormationDto request, CancellationToken ct)
        => Ok(await service.EnrollAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(programId), request, ct));

    [HttpGet("enrollments")]
    public async Task<ActionResult<Page<Versioned<FormationEnrollmentDto>>>> ListEnrollments(Guid parishId, Guid ministryId, CancellationToken ct,
        string? status = null, int size = 25, string? cursor = null)
        => Ok(await service.ListEnrollmentsAsync(Guard.Id(parishId), Guard.Id(ministryId), status, size, cursor, ct));

    [HttpGet("enrollments/mine")]
    public async Task<ActionResult<Page<Versioned<FormationEnrollmentDto>>>> Mine(Guid parishId, Guid ministryId, CancellationToken ct,
        int size = 25, string? cursor = null)
        => Ok(await service.OwnEnrollmentsAsync(Guard.Id(parishId), Guard.Id(ministryId), size, cursor, ct));

    [HttpGet("enrollments/{enrollmentId:guid}")]
    public async Task<ActionResult<Versioned<FormationEnrollmentDto>>> GetEnrollment(Guid parishId, Guid ministryId, Guid enrollmentId, CancellationToken ct)
        => Ok(await service.GetEnrollmentAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(enrollmentId), ct));

    [HttpPost("enrollments/{enrollmentId:guid}/milestones")]
    public async Task<ActionResult<FormationEnrollmentDto>> Progress(Guid parishId, Guid ministryId, Guid enrollmentId, FormationProgressDto request, CancellationToken ct)
        => Ok(await service.ProgressAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(enrollmentId), request, ct));

    [HttpPost("enrollments/{enrollmentId:guid}/actions")]
    public async Task<ActionResult<FormationEnrollmentDto>> EnrollmentAction(Guid parishId, Guid ministryId, Guid enrollmentId, FormationEnrollmentActionDto request, CancellationToken ct)
        => Ok(await service.EnrollmentActionAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(enrollmentId), request, ct));

    [HttpGet("people/{personId:guid}/history")]
    public async Task<ActionResult<Page<FormationHistoryDto>>> History(Guid parishId, Guid ministryId, Guid personId, CancellationToken ct,
        int size = 25, string? cursor = null)
        => Ok(await service.HistoryAsync(Guard.Id(parishId), Guard.Id(ministryId), Guard.Id(personId), size, cursor, ct));
}
