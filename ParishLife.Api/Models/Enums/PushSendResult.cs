// Purpose: the push service's answer for one device.
// Members: Sent (accepted), Gone (the browser dropped the subscription: 404 or 410, so the device is removed), Failed (try again later).

namespace ParishLife.Api.Models.Enums;

public enum PushSendResult
{
    Sent,
    Gone,
    Failed
}
