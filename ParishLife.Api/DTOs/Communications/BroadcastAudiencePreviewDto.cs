// Purpose: counts who a broadcast would currently reach, without naming anyone; the final audience is resolved again at send time.
// Main members: EligibleCount and SkippedByPreferenceCount.

namespace ParishLife.Api.DTOs.Communications;

public class BroadcastAudiencePreviewDto
{
    public int EligibleCount { get; set; }

    public int SkippedByPreferenceCount { get; set; }
}
