// Purpose: one parish's labelled aggregate counts on the bishop overview; counts only, never record contents or people.
// Main members: ParishId, Name, Locality, Status, CurrentPriests, HeadPriestDesignated, OtherCurrentStaff, OpenRequests, RequestsReceived, CertificatesAwaitingBishop, MembershipRequestsPending, PublishedEvents.

namespace ParishLife.Api.DTOs.Reporting;

public class ParishOverviewDto
{
    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Locality { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public int CurrentPriests { get; set; }

    public bool HeadPriestDesignated { get; set; }

    public int OtherCurrentStaff { get; set; }

    public int OpenRequests { get; set; }

    public int RequestsReceived { get; set; }

    public int CertificatesAwaitingBishop { get; set; }

    public int MembershipRequestsPending { get; set; }

    public int PublishedEvents { get; set; }
}
