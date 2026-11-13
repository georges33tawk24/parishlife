// Purpose: lists the in-app notification topics the API produces, so the member's preferences offer switches only where a mute has effect.
// Main functions: List; optional topics come from the producers' own constants, required topics are the StageRequired topics,
// which no preference suppresses (see docs/operations/required-notification-outbox.md). A test keeps this list in step with the source.

using ParishLife.Api.DTOs.PersonalWorkspace;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Reporting;

namespace ParishLife.Api.Services.PersonalWorkspace;

public class NotificationTopicCatalog
{
    internal static readonly string[] OptionalTopics = [BroadcastService.Topic, ReportScheduleProcessor.Topic];

    internal static readonly string[] RequiredTopics =
    [
        "certificate.update", "concern.update", "inbox.message", "incident.assigned", "letter.update", "membership.decision",
        "parish.ownership_claim", "parish.status", "person.invitation", "profile.correction", "registration.update", "request.update"
    ];

    public NotificationTopicDto[] List()
        => [.. OptionalTopics.Select(topic => new NotificationTopicDto { Topic = topic, Required = false, Mutable = true }),
            .. RequiredTopics.Select(topic => new NotificationTopicDto { Topic = topic, Required = true, Mutable = false })];
}
