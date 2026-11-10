// Purpose: represents one entry on a concern with a fixed audience: reviewer-only note, message to the submitter, information request or submitter message.
// Main members: Id, RequestId (the concern), Kind, AuthorAccountId, ProtectedBody and At.

namespace ParishLife.Api.Models;

public class ConcernEntry
{
    public string Id { get; set; } = string.Empty;

    // The concern case this entry belongs to.
    public string RequestId { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public string AuthorAccountId { get; set; } = string.Empty;

    public string ProtectedBody { get; set; } = string.Empty;

    public DateTimeOffset At { get; set; }
}
