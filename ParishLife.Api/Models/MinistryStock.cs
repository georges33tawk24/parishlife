// Purpose: represents one counted kind of physical belonging owned by a ministry, reconciled with its loans.
// Main members: Id, ParishId, MinistryId, Name/NameAr, Storage/StorageAr, Total, OnLoan, Status and last change facts.

namespace ParishLife.Api.Models;

public class MinistryStock
{
    public string Id { get; set; } = string.Empty;

    public string ParishId { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    public string? Storage { get; set; } = null;

    public string? StorageAr { get; set; } = null;

    public int Total { get; set; }

    // Units currently issued and not returned or reported missing.
    public int OnLoan { get; set; }

    // Active or Retired; retired stock accepts no new requests.
    public string Status { get; set; } = "Active";

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
