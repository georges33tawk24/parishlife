// Purpose: the WebRTC settings the portal uses for calls: the STUN/TURN servers from configuration (Calls:IceServers).
// Main members: IceServers.

namespace ParishLife.Api.DTOs.Communications;

public class CallSettingsDto
{
    public string[] IceServers { get; set; } = Array.Empty<string>();
}
