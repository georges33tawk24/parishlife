// Purpose: represents ministry rules business state and rules.
// Main functions: IsLiturgy.

namespace ParishLife.Api.Models;

public static class MinistryRules
{
    public static readonly IReadOnlySet<string> AttendanceStatuses = new HashSet<string>(StringComparer.Ordinal)
    {
        "Present",
        "Late",
        "Absent",
        "Excused",
        "NotExpected",
        "NotRecorded"
    };
    public static bool IsLiturgy(string kind) => kind.Equals("Mass", StringComparison.OrdinalIgnoreCase) || kind.Equals("Liturgy", StringComparison.OrdinalIgnoreCase) || kind.Equals("DivineLiturgy", StringComparison.OrdinalIgnoreCase);
}
