// Purpose: one telephone number of a person, kept apart from the account and from the free-text contact.
// Main members: Number (international form, "+" then digits, such as +96171821056) and Kind (Mobile, Landline, or null when a
// foreign number's kind was not stated; Lebanese numbers are classified from their prefix).

namespace ParishLife.Api.Models;

public class PersonPhone
{
    public string Number { get; set; } = string.Empty;

    public string? Kind { get; set; } = null;
}
