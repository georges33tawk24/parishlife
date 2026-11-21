// Purpose: proves the caller's WhatsApp number with the six-digit code it received; the code never enters receipts or audit.
// Main member: Code.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Communications;

public class ConfirmWhatsAppDto
{
    [Required, RegularExpression("^[0-9]{6}$")]
    public string Code { get; set; } = string.Empty;
}
