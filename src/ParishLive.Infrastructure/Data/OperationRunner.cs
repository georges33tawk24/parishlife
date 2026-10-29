using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;

namespace ParishLive.Infrastructure.Data;

public sealed record OperationResult(Guid Id, long Revision, bool Replayed = false);

/// <summary>Idempotency, revision checks and primary facts share the database transaction.</summary>
public sealed class OperationRunner(AppDbContext db, ITenantContext tenant)
{
    public async Task<OperationResult> RunAsync(Guid parishId, Guid operationId, string action, object payload,
        Func<Task<OperationResult>> commit)
    {
        if (operationId == Guid.Empty || tenant.UserId is null) throw new DomainException("Error.OperationRequired");
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload))));
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var prior = await db.Operations.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(o =>
            o.ActorUserId == tenant.UserId && o.OperationId == operationId);
        if (prior is not null)
        {
            if (prior.Action != action || prior.ParishId != parishId || prior.PayloadHash != hash)
                throw new DomainException("Error.OperationMismatch");
            return new(prior.ResultId, prior.ResultRevision, true);
        }
        try
        {
            var result = await commit();
            var owningOrg = await db.Parishes.IgnoreQueryFilters().Where(p => p.Id == parishId).Select(p => p.OrgId).SingleAsync();
            db.Operations.Add(new OperationReceipt { OrgId = owningOrg, ParishId = parishId,
                ActorUserId = tenant.UserId, OperationId = operationId, Action = action,
                PayloadHash = hash, ResultId = result.Id, ResultRevision = result.Revision });
            await db.SaveChangesAsync();
            await transaction.CommitAsync();
            return result;
        }
        catch (DbUpdateConcurrencyException)
        {
            await transaction.RollbackAsync();
            db.ChangeTracker.Clear();
            throw new DomainException("Error.Conflict");
        }
        catch (DbUpdateException ex) when (ex.InnerException is Microsoft.Data.Sqlite.SqliteException { SqliteErrorCode: 19 })
        {
            await transaction.RollbackAsync(); db.ChangeTracker.Clear();
            throw new DomainException("Error.Conflict");
        }
        catch
        {
            await transaction.RollbackAsync(); db.ChangeTracker.Clear(); throw;
        }
    }

    public static void Expect(VersionedRecord record, long revision)
    {
        if (record.Revision != revision) throw new DomainException("Error.Conflict");
    }

    public async Task<OperationResult?> LookupAsync(Guid id)
    {
        var receipt = await db.Operations.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(o =>
            o.OperationId == id && o.ActorUserId == tenant.UserId);
        return receipt is null ? null : new(receipt.ResultId, receipt.ResultRevision, true);
    }
}
