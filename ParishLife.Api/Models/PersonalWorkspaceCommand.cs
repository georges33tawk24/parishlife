// Purpose: compares private retry inputs without exposing authored text or a dictionary-testable content digest in receipts.
// Main members: Id, AccountId, ItemId, Action and ProtectedRequest, committed with the item and its revision.

namespace ParishLife.Api.Models;

public class PersonalWorkspaceCommand
{
    public string Id { get; set; } = string.Empty;
    public string AccountId { get; set; } = string.Empty;
    public string ItemId { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string ProtectedRequest { get; set; } = string.Empty;
}
