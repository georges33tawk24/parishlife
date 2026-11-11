// Purpose: tells a client exactly which public reads it may keep for offline reading and that everything else is no-store and online-only.
// Main members: CacheableReads, DefaultPolicy, OfflineWrites and Rules (plain statements of the proposed S31.05-S31.07 baseline).

namespace ParishLife.Api.DTOs.Publishing;

public class OfflinePolicyDto
{
    public PublicCacheRouteDto[] CacheableReads { get; set; } = Array.Empty<PublicCacheRouteDto>();

    public string DefaultPolicy { get; set; } = "no-store";

    public string OfflineWrites { get; set; } = "NotSupported";

    public string[] Rules { get; set; } = Array.Empty<string>();
}
