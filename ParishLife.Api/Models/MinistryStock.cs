// Purpose: represents ministry stock business state and rules.
// Main members: Id, MinistryId, Name, Total, OnLoan, Status.

namespace ParishLife.Api.Models;

public class MinistryStock
{
    public string Id { get; set; } = string.Empty;

    public string MinistryId { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public int Total { get; set; }

    public int OnLoan { get; set; }

    public string Status { get; set; } = string.Empty;
}
