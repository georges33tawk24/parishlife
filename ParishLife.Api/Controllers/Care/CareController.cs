// Purpose: exposes priests' pastoral notes, confidential concerns and bishop-appointed concern reviewers over HTTP.
// Main functions: SaveNote, UpdateNote, NoteAction, GetNote, ListNotes, ReviewerOptions, Submit, Act, PostEntry, Entries, Get, Mine,
// Assigned, AppointReviewer and EndReviewer delegate rules to PastoralNoteService and ConcernService.

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParishLife.Api.DTOs.Care;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Care;

namespace ParishLife.Api.Controllers.Care;

[Authorize, ApiController]
public class CareController(PastoralNoteService notes, ConcernService concerns) : ControllerBase
{
    [HttpPost("api/parishes/{parishId:guid}/pastoral-notes")]
    public async Task<ActionResult<PastoralNoteDto>> SaveNote(Guid parishId, SavePastoralNoteDto request, CancellationToken ct)
        => Ok(await notes.SaveAsync(Guard.Id(parishId), null, request, ct));

    [HttpPut("api/parishes/{parishId:guid}/pastoral-notes/{noteId:guid}")]
    public async Task<ActionResult<PastoralNoteDto>> UpdateNote(Guid parishId, Guid noteId, SavePastoralNoteDto request, CancellationToken ct)
        => Ok(await notes.SaveAsync(Guard.Id(parishId), Guard.Id(noteId), request, ct));

    [HttpPost("api/parishes/{parishId:guid}/pastoral-notes/{noteId:guid}/actions")]
    public async Task<ActionResult<PastoralNoteDto>> NoteAction(Guid parishId, Guid noteId, PastoralNoteActionDto request, CancellationToken ct)
        => Ok(await notes.ActAsync(Guard.Id(parishId), Guard.Id(noteId), request, ct));

    [HttpGet("api/parishes/{parishId:guid}/pastoral-notes/{noteId:guid}")]
    public async Task<ActionResult<Versioned<PastoralNoteDto>>> GetNote(Guid parishId, Guid noteId, CancellationToken ct)
        => Ok(await notes.GetAsync(Guard.Id(parishId), Guard.Id(noteId), ct));

    [HttpGet("api/parishes/{parishId:guid}/pastoral-notes")]
    public async Task<ActionResult<IReadOnlyList<Versioned<PastoralNoteDto>>>> ListNotes(Guid parishId, CancellationToken ct)
        => Ok(await notes.ListAsync(Guard.Id(parishId), ct));

    [HttpGet("api/parishes/{parishId:guid}/concerns/reviewers")]
    public async Task<ActionResult<IReadOnlyList<ReviewerOptionDto>>> ReviewerOptions(Guid parishId, CancellationToken ct)
        => Ok(await concerns.ReviewerOptionsAsync(Guard.Id(parishId), ct));

    [HttpPost("api/parishes/{parishId:guid}/concerns")]
    public async Task<ActionResult<ConcernDto>> Submit(Guid parishId, SubmitConcernDto request, CancellationToken ct)
        => Ok(await concerns.SubmitAsync(Guard.Id(parishId), request, ct));

    [HttpGet("api/parishes/{parishId:guid}/concerns/mine")]
    public async Task<ActionResult<IReadOnlyList<Versioned<ConcernDto>>>> Mine(Guid parishId, CancellationToken ct)
        => Ok(await concerns.OwnAsync(Guard.Id(parishId), ct));

    [HttpGet("api/parishes/{parishId:guid}/concerns/assigned")]
    public async Task<ActionResult<IReadOnlyList<Versioned<ConcernDto>>>> Assigned(Guid parishId, CancellationToken ct)
        => Ok(await concerns.AssignedAsync(Guard.Id(parishId), ct));

    [HttpGet("api/parishes/{parishId:guid}/concerns/{concernId:guid}")]
    public async Task<ActionResult<Versioned<ConcernDto>>> Get(Guid parishId, Guid concernId, CancellationToken ct)
        => Ok(await concerns.GetAsync(Guard.Id(parishId), Guard.Id(concernId), ct));

    [HttpPost("api/parishes/{parishId:guid}/concerns/{concernId:guid}/actions")]
    public async Task<ActionResult<ConcernDto>> Act(Guid parishId, Guid concernId, ConcernActionDto request, CancellationToken ct)
        => Ok(await concerns.ActAsync(Guard.Id(parishId), Guard.Id(concernId), request, ct));

    [HttpPost("api/parishes/{parishId:guid}/concerns/{concernId:guid}/entries")]
    public async Task<ActionResult<ConcernEntryDto>> PostEntry(Guid parishId, Guid concernId, PostConcernEntryDto request, CancellationToken ct)
        => Ok(await concerns.PostEntryAsync(Guard.Id(parishId), Guard.Id(concernId), request, ct));

    [HttpGet("api/parishes/{parishId:guid}/concerns/{concernId:guid}/entries")]
    public async Task<ActionResult<IReadOnlyList<ConcernEntryDto>>> Entries(Guid parishId, Guid concernId, CancellationToken ct)
        => Ok(await concerns.EntriesAsync(Guard.Id(parishId), Guard.Id(concernId), ct));

    [HttpPost("api/archdioceses/{archdioceseId:guid}/concern-reviewers")]
    public async Task<ActionResult<ReviewerOptionDto>> AppointReviewer(Guid archdioceseId, AppointReviewerDto request, CancellationToken ct)
        => Ok(await concerns.AppointReviewerAsync(Guard.Id(archdioceseId), request, ct));

    [HttpPost("api/archdioceses/{archdioceseId:guid}/concern-reviewers/{reviewerId:guid}/end")]
    public async Task<ActionResult<ReviewerOptionDto>> EndReviewer(Guid archdioceseId, Guid reviewerId, EndReviewerDto request, CancellationToken ct)
        => Ok(await concerns.EndReviewerAsync(Guard.Id(archdioceseId), Guard.Id(reviewerId), request, ct));
}
