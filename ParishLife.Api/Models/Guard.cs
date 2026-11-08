// Purpose: represents guard business state and rules.
// Main functions: Text, Id, Utc.

namespace ParishLife.Api.Models;

public static class Guard
{
    public static string Text(string? value, string name, int maximum = 200)
    {
        var text = value?.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > maximum)
            throw new DomainException("invalid_input", $"{name} is required and must not exceed {maximum} characters.");
        return text;
    }

    public static string Id(Guid id)
    {
        if (id == Guid.Empty)
            throw new DomainException("invalid_id", "A nonempty UUID is required.");
        return id.ToString("N");
    }

    public static DateTimeOffset Utc(DateTimeOffset value)
    {
        if (value == default || value.Offset != TimeSpan.Zero)
            throw new DomainException("invalid_instant", "An explicit UTC instant is required.");
        return value;
    }
}
