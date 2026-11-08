// Purpose: defines the existing private storage service and business-evidence container configuration.
// Main members: ServiceUri and EvidenceContainer; no files, containers, or sample records are created here.

namespace ParishLife.Api.Configuration;

public sealed class BlobStorageOptions
{
    public string ServiceUri { get; set; } = "https://storageparishlife.blob.core.windows.net/";
    public string EvidenceContainer { get; set; } = "evidence";
}
