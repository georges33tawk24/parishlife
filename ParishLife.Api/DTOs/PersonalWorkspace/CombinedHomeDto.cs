// Purpose: the signed-in account's combined home across all its parishes: its own relationships, its own counts and the capacities it may
// explicitly choose. It contains no office records or counts; work queues are read per parish in one chosen capacity.
// Main members: HomeState (NoParish, Personal, AwaitingAssignment, SingleCapacity, ChooseCapacity), DirectCapacity, SessionHasMfa, Parishes,
// Capacities, UnreadNotifications, PendingStaffInvitations, DirectoryLink and ComputedAt.

namespace ParishLife.Api.DTOs.PersonalWorkspace;

public class CombinedHomeDto
{
    public string HomeState { get; set; } = string.Empty;

    public CapacityDto? DirectCapacity { get; set; } = null;

    public bool SessionHasMfa { get; set; }

    public HomeParishDto[] Parishes { get; set; } = Array.Empty<HomeParishDto>();

    public CapacityDto[] Capacities { get; set; } = Array.Empty<CapacityDto>();

    public int UnreadNotifications { get; set; }

    public int PendingStaffInvitations { get; set; }

    public string DirectoryLink { get; set; } = "/api/public/parishes";

    public DateTimeOffset ComputedAt { get; set; }
}
