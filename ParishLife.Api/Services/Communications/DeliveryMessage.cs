// Purpose: what an outside channel sends for one notice or broadcast: a short title, an optional body and the sign-in link.
// Main members: Title, Body (broadcasts only; notices carry their neutral title alone), Link and Language (en or ar, the recipient's choice).

namespace ParishLife.Api.Services.Communications;

public class DeliveryMessage
{
    public string Title { get; set; } = string.Empty;

    public string? Body { get; set; } = null;

    public string Link { get; set; } = string.Empty;

    public string Language { get; set; } = "en";
}
