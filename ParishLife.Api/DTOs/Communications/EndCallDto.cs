// Purpose: ends, declines or cancels a call.
// Main members: Reason (Ended, Declined, Cancelled, NoAnswer, Busy or Failed).

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Communications;

public class EndCallDto
{
    [Required]
    [RegularExpression("^(Ended|Declined|Cancelled|NoAnswer|Busy|Failed)$")]
    public string Reason { get; set; } = "Ended";
}
