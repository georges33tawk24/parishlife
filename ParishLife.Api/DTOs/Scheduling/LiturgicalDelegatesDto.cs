// Purpose: the current calendar delegates of an archdiocese, for the bishop.
// Main members: Version (null until a list was saved) and Delegates.

namespace ParishLife.Api.DTOs.Scheduling;

public class LiturgicalDelegatesDto
{
    public string? Version { get; set; } = null;

    public List<LiturgicalDelegateDto> Delegates { get; set; } = [];
}
