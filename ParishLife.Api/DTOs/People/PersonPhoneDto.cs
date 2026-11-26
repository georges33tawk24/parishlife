// Purpose: one phone number of a person, as sent by the office and as returned with the person.
// Main members: Number (international "+961 71 821 056" or a Lebanese number such as "71 821 056"; stored as +96171821056) and
// Kind (Mobile or Landline; Lebanese numbers are classified from their prefix, so the kind sent is used only for foreign numbers).

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.People;

public class PersonPhoneDto
{
    [Required]
    [StringLength(30)]
    [RegularExpression(@"^\+?[0-9 ().\-]+$")]
    public string Number { get; set; } = string.Empty;

    [RegularExpression("^(Mobile|Landline)$")]
    public string? Kind { get; set; } = null;
}
