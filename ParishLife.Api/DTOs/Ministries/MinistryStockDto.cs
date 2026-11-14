// Purpose: returns one ministry stock item with its available quantity.
// Main members: Id, MinistryId, Name/NameAr, Storage/StorageAr, Total, OnLoan, Available, Status, UpdatedBy and UpdatedAt.

namespace ParishLife.Api.DTOs.Ministries;

public class MinistryStockDto
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? NameAr { get; set; } = null;

    public string? Storage { get; set; } = null;

    public string? StorageAr { get; set; } = null;

    public int Total { get; set; }

    public int OnLoan { get; set; }

    public int Available { get; set; }

    public string Status { get; set; } = string.Empty;

    public string UpdatedBy { get; set; } = string.Empty;

    public DateTimeOffset UpdatedAt { get; set; }
}
