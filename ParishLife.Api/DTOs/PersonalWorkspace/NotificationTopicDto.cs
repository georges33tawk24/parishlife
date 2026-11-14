// Purpose: describes one in-app notification topic and whether the account's mute choice can affect it.
// Main members: Topic, Required (always stored regardless of preferences) and Mutable (a mute in preferences suppresses it).

namespace ParishLife.Api.DTOs.PersonalWorkspace;

public class NotificationTopicDto
{
    public string Topic { get; set; } = string.Empty;
    public bool Required { get; set; }
    public bool Mutable { get; set; }
}
