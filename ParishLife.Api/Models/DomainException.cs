// Purpose: represents domain exception business state and rules.
// Main members: Code, Kind.

using ParishLife.Api.Models.Enums;


namespace ParishLife.Api.Models;

public sealed class DomainException(string code, string message, FailureKind kind = FailureKind.Validation) : Exception(message)
{
    public string Code { get; } = code;
    public FailureKind Kind { get; } = kind;
}
