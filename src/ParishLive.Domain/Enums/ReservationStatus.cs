namespace ParishLive.Domain.Enums;

/// <summary>
/// The reservation lifecycle (Part 9). Transitions are validated server-side against an
/// explicit per-role transition table — the client can never drive an illegal transition.
/// </summary>
public enum ReservationStatus
{
    Draft,
    Submitted,
    UnderSecretaryReview,
    InformationRequired,
    ReturnedForCorrection,
    ForwardedToPriest,
    UnderFinalReview,
    Approved,
    Rejected,
    Cancelled,
    InProgress,
    Completed,
    Expired
}
