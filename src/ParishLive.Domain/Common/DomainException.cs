namespace ParishLive.Domain.Common;

/// <summary>Thrown when a business rule / invariant is violated (distinct from technical errors).</summary>
public sealed class DomainException : Exception
{
    public DomainException(string message) : base(message) { }
}
