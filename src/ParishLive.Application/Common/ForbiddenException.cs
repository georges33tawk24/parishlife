namespace ParishLive.Application.Common;

/// <summary>Thrown when an authenticated user lacks the permission required for an action.</summary>
public sealed class ForbiddenException : Exception
{
    public ForbiddenException(string message) : base(message) { }
}
