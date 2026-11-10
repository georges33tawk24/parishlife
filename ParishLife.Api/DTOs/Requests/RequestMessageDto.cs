// Purpose: returns one request message; applicants only ever receive Applicant-audience messages.
// Main members: Id, Audience, AuthorKind, AuthorAccountId, Body and At.

namespace ParishLife.Api.DTOs.Requests;

public class RequestMessageDto
{
    public string Id { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    public string AuthorKind { get; set; } = string.Empty;

    public string? AuthorAccountId { get; set; } = null;

    public string Body { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
