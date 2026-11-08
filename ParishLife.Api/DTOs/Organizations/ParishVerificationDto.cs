// Purpose: represents parish verification input/output data.
// Main functions: From.

using ParishLife.Api.Models;

namespace ParishLife.Api.DTOs.Organizations;

public class ParishVerificationDto
{
    public ParishDto Parish { get; set; } = new();

    public string? VerificationReference { get; set; }

    public static ParishVerificationDto From(Parish value) => new ParishVerificationDto
    {
        Parish = ParishDto.From(value),
        VerificationReference = value.VerificationReference
    };
}
