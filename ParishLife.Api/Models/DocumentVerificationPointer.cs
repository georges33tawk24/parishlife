// Purpose: platform-wide lookup from a printed verification code to the parish that holds the signature record.
// Main members: Code and ParishId; written before the signature commit, so an orphan pointer only ever resolves to "not found".

namespace ParishLife.Api.Models;

public class DocumentVerificationPointer
{
    public string Code { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;
}
