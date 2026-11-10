// Purpose: reports whether one language is complete for every block that the draft would publish.
// Main members: Language, Complete and Missing (the block ids and fields still empty).

namespace ParishLife.Api.DTOs.Publishing;

public class HomepageReadinessDto
{
    public string Language { get; set; } = string.Empty;
    public bool Complete { get; set; }
    public string[] Missing { get; set; } = [];
}
