// Purpose: an anonymous public-site beacon: one allowlisted page/action kind, optional display language and parish. It carries no visitor,
// device, referrer, search text or location data and is never treated as an audited fact.
// Main members: Kind, Language and ParishId.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Reporting;

public class RecordSiteMetricDto
{
    [Required, StringLength(40)]
    public string Kind { get; set; } = string.Empty;

    [StringLength(8)]
    public string? Language { get; set; } = null;

    public Guid? ParishId { get; set; } = null;
}
