// Purpose: decides whether a stored notice or a sent broadcast is also queued for outside delivery, and builds that queue row so the
// source writes it in its own transaction (DeliveryProcessor sends it later). Nothing is queued while no outside channel is configured.
// Main members: ChannelNames, AnyConfigured, Configured(channel), NoticeWork (account partition, beside the notice) and BroadcastWork (parish
// partition, beside the broadcast).

using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;
using ParishLife.Api.Models;

namespace ParishLife.Api.Services.Communications;

public class DeliveryQueue(IOptions<EmailOptions> email, IOptions<WebPushOptions> push, IOptions<WhatsAppOptions> whatsApp, TimeProvider clock)
{
    public const string Type = "deliveryWork";

    // The outside channels in the order screens list them.
    public static readonly string[] ChannelNames = ["Email", "WhatsApp", "Push"];

    public bool AnyConfigured => email.Value.Configured || push.Value.Configured || whatsApp.Value.Configured;

    public bool Configured(string channel) => channel switch
    {
        "Email" => email.Value.Configured,
        "WhatsApp" => whatsApp.Value.Configured,
        "Push" => push.Value.Configured,
        _ => false
    };

    public RecordChange? NoticeWork(Notification notice)
    {
        if (!AnyConfigured)
            return null;
        var work = new DeliveryWork
        {
            Id = "notice:" + notice.Id, Kind = "Notice", AccountId = notice.AccountId, ParishId = notice.ParishId, SourceId = notice.Id,
            Title = notice.Title, CreatedAt = clock.GetUtcNow()
        };
        return RecordChange.Create(Type + ":" + work.Id, Type, work);
    }

    public RecordChange? BroadcastWork(Broadcast broadcast)
    {
        if (!AnyConfigured || broadcast.RecipientAccountIds.Count == 0)
            return null;
        var work = new DeliveryWork
        {
            Id = "broadcast:" + broadcast.Id, Kind = "Broadcast", ParishId = broadcast.ParishId, SourceId = broadcast.Id, CreatedAt = clock.GetUtcNow()
        };
        return RecordChange.Create(Type + ":" + work.Id, Type, work);
    }
}
