// Purpose: returns a new person invitation's token once, to the issuing office.
// Main members: Id, PersonId, ExpiresAt, Delivery and Token.

namespace ParishLife.Api.DTOs.People;

public class PersonInvitationIssuedDto
{
    public string Id { get; set; } = string.Empty;

    public string PersonId { get; set; } = string.Empty;

    public DateTimeOffset ExpiresAt { get; set; }

    public string Delivery { get; set; } = string.Empty;

    public string Token { get; set; } = string.Empty;
}
