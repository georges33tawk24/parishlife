// Purpose: previews a people export before it is generated: row count, columns and what is always excluded.
// Main members: Count, Columns, IncludeArchived and Excluded.

namespace ParishLife.Api.DTOs.People;

public class PeopleExportPreviewDto
{
    public int Count { get; set; }

    public string[] Columns { get; set; } = Array.Empty<string>();

    public bool IncludeArchived { get; set; }

    public string[] Excluded { get; set; } = Array.Empty<string>();
}
