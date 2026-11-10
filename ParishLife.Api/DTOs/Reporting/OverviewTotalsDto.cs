// Purpose: jurisdiction-wide totals of the bishop overview measures; priests are distinct accounts, so one priest serving two parishes counts once.
// Main members: Parishes, ParishesWithoutHeadPriest, CurrentPriests, OtherCurrentStaff, OpenRequests, RequestsReceived, CertificatesAwaitingBishop, MembershipRequestsPending, PublishedEvents.

namespace ParishLife.Api.DTOs.Reporting;

public class OverviewTotalsDto
{
    public int Parishes { get; set; }

    public int ParishesWithoutHeadPriest { get; set; }

    public int CurrentPriests { get; set; }

    public int OtherCurrentStaff { get; set; }

    public int OpenRequests { get; set; }

    public int RequestsReceived { get; set; }

    public int CertificatesAwaitingBishop { get; set; }

    public int MembershipRequestsPending { get; set; }

    public int PublishedEvents { get; set; }
}
