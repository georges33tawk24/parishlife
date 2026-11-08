// Purpose: records an accepted and dated Archdiocese Admin or parish-priest appointment with explicit operational duties.
// Main members: scope, identity, duties and workflow dates; IsEffective, IsHead, Permits and interval properties derive current authority.

using System.Text.Json.Serialization;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Models;

public class StaffAppointment
{
    public bool IsEffective(DateTimeOffset now) => Status == "Accepted" && RespondedAt is not null && RespondedAt <= now
        && InvitedAt <= RespondedAt && RespondedAt < AcceptBy
        && StartsAt <= now && (EndsAt is null || now < EndsAt) && !string.IsNullOrWhiteSpace(EvidenceReference)
        && !string.IsNullOrWhiteSpace(AuthorizingBishopAppointmentId) && AccountId != InvitedBy;

    [JsonIgnore]
    public bool ReservesPeriod => Status is "Accepted" or "Suspended" && RespondedAt is not null;

    [JsonIgnore]
    public DateTimeOffset EffectiveStart => RespondedAt > StartsAt ? RespondedAt.Value : StartsAt;

    [JsonIgnore]
    public bool HasHeadPeriod => Role == StaffAppointmentRole.Priest && HeadStartsAt is not null
        && (HeadEndsAt is null || HeadEndsAt > HeadStartsAt);

    public bool IsHead(DateTimeOffset now) => IsEffective(now) && HasHeadPeriod
        && HeadStartsAt <= now && (HeadEndsAt is null || now < HeadEndsAt);

    public bool Permits(string permission, DateTimeOffset now) => IsEffective(now)
        && Allows.Contains(permission, StringComparer.Ordinal) && !Denies.Contains(permission, StringComparer.Ordinal);


    public string Id { get; set; } = string.Empty;

    public string ArchdioceseId { get; set; } = string.Empty;

    public string? ParishId { get; set; }

    public string AccountId { get; set; } = string.Empty;

    public string ScopeName { get; set; } = string.Empty;

    public StaffAppointmentRole Role { get; set; }

    public string[] Allows { get; set; } = Array.Empty<string>();

    public string[] Denies { get; set; } = Array.Empty<string>();

    public DateTimeOffset StartsAt { get; set; }

    public DateTimeOffset? EndsAt { get; set; }

    public DateTimeOffset AcceptBy { get; set; }

    public DateTimeOffset? ReviewDueAt { get; set; }

    public string AuthorizingBishopAppointmentId { get; set; } = string.Empty;

    public string InvitedBy { get; set; } = string.Empty;

    public DateTimeOffset InvitedAt { get; set; }

    public string EvidenceReference { get; set; } = string.Empty;

    public string Reason { get; set; } = string.Empty;

    public string Status { get; set; } = "Invited";

    public DateTimeOffset? RespondedAt { get; set; }

    public string? ResponseReason { get; set; }

    public string? LastActionBy { get; set; }

    public DateTimeOffset? LastActionAt { get; set; }

    public string? LastActionReason { get; set; }

    public DateTimeOffset? LastReviewedAt { get; set; }

    public string? LastReviewedBy { get; set; }

    public DateTimeOffset? HeadStartsAt { get; set; }

    public DateTimeOffset? HeadEndsAt { get; set; }
}
