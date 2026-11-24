// Purpose: shared settings for outside delivery of notices and broadcasts.
// Main members: SiteUrl, the public address an email, push or WhatsApp message links to (people sign in there to read the full notice).

namespace ParishLife.Api.Configuration;

public class DeliveryOptions
{
    public string SiteUrl { get; set; } = "https://parish-life.org";
}
