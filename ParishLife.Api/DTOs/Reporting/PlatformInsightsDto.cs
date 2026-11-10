// Purpose: Super Admin insights: anonymous public-site counts for an explicit day range and platform parish setup coverage, with notes on what the numbers do and do not mean.
// Main members: From, To, GeneratedAt, SiteMetrics, ParishesByStatus, ParishesWithJurisdiction, ParishesWithoutJurisdiction, Notes.

namespace ParishLife.Api.DTOs.Reporting;

public class PlatformInsightsDto
{
    public DateOnly From { get; set; }

    public DateOnly To { get; set; }

    public DateTimeOffset GeneratedAt { get; set; }

    public SiteMetricCountDto[] SiteMetrics { get; set; } = Array.Empty<SiteMetricCountDto>();

    public ParishStatusCountDto[] ParishesByStatus { get; set; } = Array.Empty<ParishStatusCountDto>();

    public int ParishesWithJurisdiction { get; set; }

    public int ParishesWithoutJurisdiction { get; set; }

    public string[] Notes { get; set; } = Array.Empty<string>();
}
