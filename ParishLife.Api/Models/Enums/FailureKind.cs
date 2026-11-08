// Purpose: represents failure kind business state and rules.
// Main members: the declared named values or shared rule constants.

namespace ParishLife.Api.Models.Enums;

public enum FailureKind
{
    Validation,
    NotFound,
    Forbidden,
    Conflict,
    Unavailable
}
