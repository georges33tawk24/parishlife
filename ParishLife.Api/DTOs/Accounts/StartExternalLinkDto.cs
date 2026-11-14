// Purpose: the browser form post that starts linking an external provider with a ticket from the link/ticket route.
// Main members: Ticket and ReturnTo ("portal" sends the person back to the portal page instead of a JSON answer).

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Accounts;

public class StartExternalLinkDto
{
    [Required]
    [StringLength(2000)]
    public string Ticket { get; set; } = string.Empty;

    [RegularExpression("^portal$")]
    public string? ReturnTo { get; set; } = null;
}
