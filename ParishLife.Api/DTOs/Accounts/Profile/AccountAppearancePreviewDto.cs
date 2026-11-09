// Purpose: returns a non-persisted normalized appearance preview with readable foreground, link, focus and boundary colors.
// Main members: Appearance holds canonical choices; contrast ratios describe computed color pairs, not a frontend accessibility certification.

namespace ParishLife.Api.DTOs.Accounts.Profile;

public class AccountAppearancePreviewDto
{
    public AccountAppearanceDto Appearance { get; set; } = new();

    public string PrimaryForeground { get; set; } = string.Empty;

    public string SurfaceColor { get; set; } = string.Empty;

    public string SurfaceForeground { get; set; } = string.Empty;

    public string FocusColor { get; set; } = string.Empty;

    public string PrimaryOutlineColor { get; set; } = string.Empty;

    public string LinkColor { get; set; } = string.Empty;

    public double PrimaryTextContrast { get; set; }

    public double LinkContrast { get; set; }

    public bool OverridesSemanticStatusColors { get; set; }

    public bool Saved { get; set; }
}
