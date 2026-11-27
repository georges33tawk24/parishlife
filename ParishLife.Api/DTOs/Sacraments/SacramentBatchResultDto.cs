// Purpose: returns a group sacrament request's per-person results in the order the people were sent.
// Main members: BatchId (null when no case could be opened, so nothing was stored), Sacrament, Replayed (true when this is the stored
// result of an earlier identical request), CreatedCount, FailedCount and Items.

namespace ParishLife.Api.DTOs.Sacraments;

public class SacramentBatchResultDto
{
    public string? BatchId { get; set; } = null;

    public string Sacrament { get; set; } = string.Empty;

    public bool Replayed { get; set; }

    public int CreatedCount { get; set; }

    public int FailedCount { get; set; }

    public SacramentBatchItemDto[] Items { get; set; } = Array.Empty<SacramentBatchItemDto>();
}
