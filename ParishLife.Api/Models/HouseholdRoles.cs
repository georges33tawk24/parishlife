// Purpose: the roles the office may record for a member inside a household (a label on the membership, never on the Person).
// Main members: Pattern (the validation expression for DTOs), All (the accepted values) and Head (the one role a household holds at most once).
// Guardianship is deliberately absent: it is a recorded relationship with evidence, never a household label.

namespace ParishLife.Api.Models;

public static class HouseholdRoles
{
    public const string Pattern = "^(Head|Spouse|Parent|Father|Mother|Child|Son|Daughter|Sibling|Grandchild|OtherRelative)$";

    public const string Head = "Head";

    public static readonly string[] All = ["Head", "Spouse", "Parent", "Father", "Mother", "Child", "Son", "Daughter", "Sibling", "Grandchild", "OtherRelative"];
}
