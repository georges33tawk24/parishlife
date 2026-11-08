// Purpose: represents product modules business state and rules.
// Main members: the declared named values or shared rule constants.

namespace ParishLife.Api.Models;

public static class ProductModules
{
    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        "core",
        "office",
        "requests",
        "sacraments",
        "ministries",
        "facilities",
        "finance"
    };
}
