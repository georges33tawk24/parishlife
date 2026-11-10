// Purpose: reports a bank import: the batch and how many lines were new or already imported.
// Main members: BatchId, Imported and Duplicates.

namespace ParishLife.Api.DTOs.Finance;

public class BankImportResultDto
{
    public string BatchId { get; set; } = string.Empty;

    public int Imported { get; set; }

    public int Duplicates { get; set; }
}
