using System.Globalization;
using ParishLive.Domain.Common;

namespace ParishLive.Web.Forms;

public static class UtcInput
{
    public static DateTimeOffset Parse(string? value)
    {
        if (!DateTime.TryParseExact(value, ["yyyy-MM-ddTHH:mm", "yyyy-MM-ddTHH:mm:ss"], CultureInfo.InvariantCulture,
            DateTimeStyles.None, out var parsed)) throw new DomainException("Error.Invalid");
        return new DateTimeOffset(DateTime.SpecifyKind(parsed, DateTimeKind.Utc));
    }
}
