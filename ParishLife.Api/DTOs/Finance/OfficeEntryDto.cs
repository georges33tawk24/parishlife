// Purpose: shows an office ledger entry and whether its month is closed.
// Main members: Id, Version, Kind, OccurredOn, Amount, Currency, Description, Supplier, EvidenceReference, MissingEvidenceReason,
// FinanceReference, ReversalOf, Status, DeleteReason, CreatedBy and MonthClosed.

namespace ParishLife.Api.DTOs.Finance;

public class OfficeEntryDto
{
    public string Id { get; set; } = string.Empty;

    public string Version { get; set; } = string.Empty;

    public string Kind { get; set; } = string.Empty;

    public DateOnly OccurredOn { get; set; }

    public decimal Amount { get; set; }

    public string Currency { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? Supplier { get; set; }

    public string? EvidenceReference { get; set; }

    public string? MissingEvidenceReason { get; set; }

    public string? FinanceReference { get; set; }

    public string? ReversalOf { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? DeleteReason { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public bool MonthClosed { get; set; }
}
