namespace ParishLive.Web;

/// <summary>
/// Marker type for the shared string catalogue. Strings live in
/// Resources/SharedResource.resx (English/neutral) and Resources/SharedResource.ar.resx (Arabic),
/// consumed in views via <c>@inject IStringLocalizer&lt;SharedResource&gt; L</c>.
/// No user-facing string is hard-coded (Part 1, rule 9).
/// </summary>
public sealed class SharedResource
{
}
