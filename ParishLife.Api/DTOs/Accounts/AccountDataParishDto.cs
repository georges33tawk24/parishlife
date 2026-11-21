// Purpose: one parish's part of a person's data copy: the linked person record with its corrections, and the own-data view
// (optional facts, consents and counts of kept records).
// Main members: Record, Data.

using ParishLife.Api.DTOs.Accounts.Records;
using ParishLife.Api.DTOs.People;

namespace ParishLife.Api.DTOs.Accounts;

public class AccountDataParishDto
{
    public AccountParishRecordDto Record { get; set; } = new();

    public OwnDataDto? Data { get; set; }
}
