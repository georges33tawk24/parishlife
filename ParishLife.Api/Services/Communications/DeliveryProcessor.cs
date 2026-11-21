// Purpose: works through queued outside deliveries (DeliveryWork) without a browser identity, in bounded pages.
// Main functions: ProcessNoticesAsync (account partitions: each notice goes to its recipient on every chosen channel; a channel that failed is
// retried on later ticks up to three attempts, and channels already done are never repeated), ProcessBroadcastsAsync (parish partitions: 25
// recipients of a sent broadcast per tick, in their language, one attempt each), and the message helpers. A row is removed once handled.

using Microsoft.Extensions.Options;
using ParishLife.Api.Configuration;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Communications;

public class DeliveryProcessor(IRecordTransactions records, DeliveryService delivery, IOptions<DeliveryOptions> options, TimeProvider clock,
    ILogger<DeliveryProcessor> logger)
{
    internal const int MaximumAttempts = 3;
    internal const int BroadcastBatch = 25;

    private string SignInLink => options.Value.SiteUrl.TrimEnd('/') + "/index.html";

    public async Task<string?> ProcessNoticesAsync(string? cursor, CancellationToken ct)
    {
        var page = await records.ScanWorkAsync<DeliveryWork>(RecordArea.Account, DeliveryQueue.Type, 25, cursor, ct);
        foreach (var row in page.Items.Where(row => row.Value.Kind == "Notice" && row.Value.AccountId is not null))
        {
            try { await NoticeAsync(row, ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception error) { logger.LogWarning("A notice delivery remains queued. Failure type: {FailureType}", error.GetType().Name); }
        }
        return page.ContinuationToken;
    }

    public async Task<string?> ProcessBroadcastsAsync(string? cursor, CancellationToken ct)
    {
        var page = await records.ScanWorkAsync<DeliveryWork>(RecordArea.Parish, DeliveryQueue.Type, 25, cursor, ct);
        foreach (var row in page.Items.Where(row => row.Value.Kind == "Broadcast" && row.Value.ParishId is not null))
        {
            try { await BroadcastAsync(row, ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception error) { logger.LogWarning("A broadcast delivery remains queued. Failure type: {FailureType}", error.GetType().Name); }
        }
        return page.ContinuationToken;
    }

    private async Task NoticeAsync(Versioned<DeliveryWork> row, CancellationToken ct)
    {
        var work = row.Value;
        var scope = new RecordScope { Area = RecordArea.Account, OwnerId = work.AccountId! };
        var target = await delivery.TargetAsync(work.AccountId!, ct);
        var failed = false;
        if (target is not null)
        {
            var message = new DeliveryMessage { Title = work.Title, Link = SignInLink, Language = Language(target) };
            foreach (var (channel, outcome) in await delivery.DeliverAsync(target, message, work.DoneChannels, ct))
            {
                if (outcome == DeliveryOutcome.Failed)
                    failed = true;
                else
                    work.DoneChannels.Add(channel);
            }
        }
        work.Attempts++;
        await FinishAsync(scope, row, failed && work.Attempts < MaximumAttempts, ct);
    }

    private async Task BroadcastAsync(Versioned<DeliveryWork> row, CancellationToken ct)
    {
        var work = row.Value;
        var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = work.ParishId! };
        var broadcast = (await records.ReadAsync<Broadcast>(scope, "broadcast:" + work.SourceId, ct))?.Value;
        if (broadcast is not { Status: "Sent" })
        {
            await FinishAsync(scope, row, false, ct);
            return;
        }
        var batch = broadcast.RecipientAccountIds.Skip(work.Next).Take(BroadcastBatch).ToList();
        foreach (var account in batch)
        {
            var target = await delivery.TargetAsync(account, ct);
            if (target is null)
                continue;
            var ar = Language(target) == "ar" && !string.IsNullOrWhiteSpace(broadcast.TitleAr);
            var message = new DeliveryMessage
            {
                Title = ar ? broadcast.TitleAr! : broadcast.Title, Body = ar ? broadcast.BodyAr ?? broadcast.Body : broadcast.Body,
                Link = SignInLink, Language = ar ? "ar" : "en"
            };
            await delivery.DeliverAsync(target, message, [], ct); // one attempt per recipient; outcomes are not stored per person
        }
        work.Next += batch.Count;
        await FinishAsync(scope, row, work.Next < broadcast.RecipientAccountIds.Count, ct);
    }

    // Keeps the row (with its progress) for the next tick, or removes it once handled.
    private Task FinishAsync(RecordScope scope, Versioned<DeliveryWork> row, bool keep, CancellationToken ct)
    {
        var key = DeliveryQueue.Type + ":" + row.Value.Id;
        return records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), "system:delivery", new { Kind = "delivery", row.Value.Id }, clock),
            keep ? "delivery.progress" : "delivery.done", row.Value.Id,
            [keep ? RecordChange.Replace(key, DeliveryQueue.Type, row.Value, row.Version) : RecordChange.Remove(key, row.Version)],
            new CommandResult { Id = row.Value.Id, Status = keep ? "Queued" : "Done" }, ct);
    }

    private static string Language(DeliveryTarget target) => target.Preferences.Language == "ar" ? "ar" : "en";
}
