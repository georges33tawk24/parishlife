namespace ParishLive.Domain.Common;

/// <summary>Reusable invariant checks for domain factories. (Adopted from the ParishLife reference.)</summary>
public static class Guard
{
    public static Guid NotEmpty(Guid value, string name)
    {
        if (value == Guid.Empty) throw new DomainException($"{name} is required.");
        return value;
    }

    public static string Required(string? value, string name, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) throw new DomainException($"{name} is required.");
        var result = value.Trim();
        if (result.Length > maxLength) throw new DomainException($"{name} cannot exceed {maxLength} characters.");
        return result;
    }

    public static string? Optional(string? value, string name, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var result = value.Trim();
        if (result.Length > maxLength) throw new DomainException($"{name} cannot exceed {maxLength} characters.");
        return result;
    }

    public static int Positive(int value, string name)
    {
        if (value <= 0) throw new DomainException($"{name} must be greater than zero.");
        return value;
    }
}
