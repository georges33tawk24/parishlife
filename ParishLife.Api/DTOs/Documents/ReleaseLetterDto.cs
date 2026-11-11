// Purpose: releases one signed letter after the releaser re-enters what they checked; the server compares each value, not a checkbox.
// Main members: OperationId, Version, Method, ConfirmRequestReference, ConfirmAddresseeName, ConfirmContentHash and VerificationEvidence.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Documents;

public class ReleaseLetterDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^(InPerson|VerifiedAccount)$")]
    public string Method { get; set; } = string.Empty;

    [Required]
    [StringLength(40)]
    public string ConfirmRequestReference { get; set; } = string.Empty;

    [Required]
    [StringLength(200)]
    public string ConfirmAddresseeName { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^[0-9A-F]{64}$")]
    public string ConfirmContentHash { get; set; } = string.Empty;

    [StringLength(1000)]
    public string? VerificationEvidence { get; set; } = null;
}
