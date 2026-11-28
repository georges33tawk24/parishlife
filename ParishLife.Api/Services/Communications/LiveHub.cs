// Purpose: pushes small live events to a signed-in account's open portal tabs (server-sent events): a conversation changed or was read,
// and a call being placed, answered or ended. It also holds the calls that are ringing or in progress.
// Main functions: Subscribe/Unsubscribe (one reader per open tab), Publish (to every tab of one account), Online and Calls.
// ponytail: in memory, for one API instance (the current App Service plan). Several instances need a shared backplane (Azure SignalR
// or Redis) first; until then an event reaches only the tabs connected to the instance that raised it.

using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;

namespace ParishLife.Api.Services.Communications;

public class LiveHub
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<Guid, Channel<string>>> tabs = new(StringComparer.Ordinal);

    public ConcurrentDictionary<string, LiveCall> Calls { get; } = new(StringComparer.Ordinal);

    public (Guid Id, ChannelReader<string> Reader) Subscribe(string account)
    {
        var id = Guid.NewGuid();
        // A slow tab drops its oldest events rather than holding memory; the portal also refreshes on its own every 30 seconds.
        var channel = Channel.CreateBounded<string>(new BoundedChannelOptions(64) { FullMode = BoundedChannelFullMode.DropOldest });
        tabs.GetOrAdd(account, _ => new ConcurrentDictionary<Guid, Channel<string>>())[id] = channel;
        return (id, channel.Reader);
    }

    public void Unsubscribe(string account, Guid id)
    {
        if (tabs.TryGetValue(account, out var open) && open.TryRemove(id, out var channel))
            channel.Writer.TryComplete();
    }

    public bool Online(string account) => tabs.TryGetValue(account, out var open) && !open.IsEmpty;

    public void Publish(string account, object payload)
    {
        if (!tabs.TryGetValue(account, out var open)) return;
        var text = JsonSerializer.Serialize(payload, Json);
        foreach (var channel in open.Values)
            channel.Writer.TryWrite(text);
    }
}
