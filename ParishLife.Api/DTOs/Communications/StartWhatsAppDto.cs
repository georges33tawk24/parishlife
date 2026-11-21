// Purpose: asks for a one-use code on WhatsApp to prove the number the caller wants notices on.
// Main member: Phone in international form with a plus sign, e.g. +9613123456.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Communications;

public class StartWhatsAppDto
{
    [Required, RegularExpression(@"^\+[1-9][0-9]{7,14}$")]
    public string Phone { get; set; } = string.Empty;
}
