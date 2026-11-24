// Purpose: one pending outside delivery (email, push, WhatsApp) of something already stored in the app: a personal notice (stored in the
// recipient's account partition) or a sent broadcast (stored in its parish partition), written in the same transaction as its source.
// Main members: Id, Kind (Notice or Broadcast), AccountId, ParishId, SourceId, Title, Body, Next (broadcast recipients already handled),
// Attempts, DoneChannels (a notice's channels already sent, so a retry never repeats them) and CreatedAt. Removed once handled.

namespace ParishLife.Api.Models;

public class DeliveryWork
{
    public string Id { get; set; } = string.Empty;

    public string Kind { get; set; } = "Notice";

    public string? AccountId { get; set; } = null;

    public string? ParishId { get; set; } = null;

    public string SourceId { get; set; } = string.Empty;

    // A notice's neutral title; a broadcast is read from its own record when sent, so these stay empty for it.
    public string Title { get; set; } = string.Empty;

    public string? Body { get; set; } = null;

    public int Next { get; set; }

    public int Attempts { get; set; }

    public List<string> DoneChannels { get; set; } = [];

    public DateTimeOffset CreatedAt { get; set; }
}
