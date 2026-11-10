// Purpose: submits a request without an account; the office matches identity later.
// Main members: OperationId, Kind, Summary, Details, PreferredDates, RequesterName, RequesterContact, SubjectDescription, Relationship and AuthorityBasis.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Requests;

public class GuestRequestDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [RegularExpression("^(SacramentInquiry|Certificate|Facility|PriestAppointment|MassIntention|Blessing|Visit|MinistryInquiry|General)$")]
    public string Kind { get; set; } = string.Empty;

    [Required]
    [StringLength(300)]
    public string Summary { get; set; } = string.Empty;

    [Required]
    public Dictionary<string, string> Details { get; set; } = new();

    [StringLength(500)]
    public string? PreferredDates { get; set; } = null;

    [Required]
    [StringLength(200)]
    public string RequesterName { get; set; } = string.Empty;

    [Required]
    [StringLength(300)]
    public string RequesterContact { get; set; } = string.Empty;

    [Required]
    [StringLength(1000)]
    public string SubjectDescription { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(Self|Parent|Guardian|Spouse|Child|Relative|Representative|Other)$")]
    public string Relationship { get; set; } = "Self";

    [StringLength(1000)]
    public string? AuthorityBasis { get; set; } = null;
}
