// Purpose: electronically authorizes the exact previewed version of a document with a fresh personal authenticator confirmation.
// Main members: OperationId, Version, ExpectedContentHash and AuthenticatorCode; the code is a credential and never enters operation metadata.

using System.ComponentModel.DataAnnotations;
using ParishLife.Api.Validation;

namespace ParishLife.Api.DTOs.Documents;

public class AuthorizeDocumentDto
{
    [NotEmptyGuid]
    public Guid OperationId { get; set; }

    [Required]
    [StringLength(1024)]
    public string Version { get; set; } = string.Empty;

    [Required]
    [RegularExpression("^[0-9A-F]{64}$")]
    public string ExpectedContentHash { get; set; } = string.Empty;

    [Required]
    [StringLength(12, MinimumLength = 6)]
    public string AuthenticatorCode { get; set; } = string.Empty;
}
