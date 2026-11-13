// Purpose: gives a current ministry member its approved group description without office policy, roster or account information.
// Main members: ministry/parish identity, approved name/type/purpose/public information with Arabic twins, meeting times and actual lifecycle status.

namespace ParishLife.Api.DTOs.Ministries;

public class MemberMinistryDto
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; }

    public string Kind { get; set; } = string.Empty;

    public string Purpose { get; set; } = string.Empty;

    public string? PurposeAr { get; set; }

    public string? PublicInformation { get; set; }

    public string? PublicInformationAr { get; set; }

    public string? MeetingTimes { get; set; }

    public string? MeetingTimesAr { get; set; }

    public string Status { get; set; } = string.Empty;
}
