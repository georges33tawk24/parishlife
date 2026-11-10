// Purpose: submits a request: by an applicant for their own case, or by the office for a telephone/paper/in-person request.
// Main members: OperationId, Kind, Summary, Details, PreferredDates, Origin, requester contact, subject, Relationship and AuthorityBasis.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Requests;

public class SubmitRequestDto
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

    [RegularExpression("^(Telephone|Paper|InPerson)$")]
    public string? Origin { get; set; } = null;

    [StringLength(200)]
    public string? RequesterName { get; set; } = null;

    [StringLength(300)]
    public string? RequesterContact { get; set; } = null;

    [NotEmptyGuid]
    public Guid? SubjectPersonId { get; set; } = null;

    [StringLength(1000)]
    public string? SubjectDescription { get; set; } = null;

    [Required]
    [RegularExpression("^(Self|Parent|Guardian|Spouse|Child|Relative|Representative|Other)$")]
    public string Relationship { get; set; } = "Self";

    [StringLength(1000)]
    public string? AuthorityBasis { get; set; } = null;
}
