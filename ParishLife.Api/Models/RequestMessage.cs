// Purpose: represents one message on a request case; internal notes are never shown to applicants.
// Main members: Id, RequestId, Audience, AuthorKind, AuthorAccountId, Body and At.

namespace ParishLife.Api.Models;

public class RequestMessage
{
    public string Id { get; set; } = string.Empty;

    public string RequestId { get; set; } = string.Empty;

    // Applicant or Internal.
    public string Audience { get; set; } = "Applicant";

    // Applicant, Guest or Office.
    public string AuthorKind { get; set; } = string.Empty;

    public string? AuthorAccountId { get; set; } = null;

    public string Body { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
