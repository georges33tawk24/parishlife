// Purpose: represents versions business state and rules.
// Main functions: Require.

namespace ParishLife.Api.Models;

public static class Versions
{
    public static string Require(string? value) => string.IsNullOrWhiteSpace(value) ? throw new DomainException("version_required", "The current version/ETag is required.") : value;
}
