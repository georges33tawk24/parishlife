// Purpose: one parish in the combined home with the account's own, separately labelled relationships to it and its own unread notice count.
// Main members: ParishId, Name, Locality, Status, Following, Member, MembershipPending, Primary, UnreadNotifications and CapacityKinds.

namespace ParishLife.Api.DTOs.PersonalWorkspace;

public class HomeParishDto
{
    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Locality { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public bool Following { get; set; }

    public bool Member { get; set; }

    public bool MembershipPending { get; set; }

    public bool Primary { get; set; }

    public int UnreadNotifications { get; set; }

    public string[] CapacityKinds { get; set; } = Array.Empty<string>();
}
