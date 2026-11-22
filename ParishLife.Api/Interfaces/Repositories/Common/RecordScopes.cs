// Purpose: the shared factories for the two record scopes services use most, replacing the private copies of
// `new() { Area = RecordArea.Parish, OwnerId = id }` in service files (Agent 02 handoff 5). Each call returns a new scope.
// Main functions: Parish, Account.

using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Interfaces.Repositories.Common;

public static class RecordScopes
{
    public static RecordScope Parish(string parishId) => new() { Area = RecordArea.Parish, OwnerId = parishId };

    public static RecordScope Account(string accountId) => new() { Area = RecordArea.Account, OwnerId = accountId };
}
