// Purpose: Persists invoices, actual receipts, and durable coverage work using explicit Cosmos partition batches.
// Main functions: P, GetInvoiceAsync, CreateInvoiceAsync, GetReceiptsAsync, ReceiveCashAsync,
// GetActivationStatusAsync, FindDueActivationsAsync, TryLeaseAsync, CompleteActivationAsync, CommitOrReplay.

using System.Security.Cryptography;
using System.Text;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Interfaces.Repositories.Billing;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using static ParishLife.Api.Data.Cosmos.JsonDefaults;

namespace ParishLife.Api.Repositories.Billing;

internal sealed class BillingRepository(PartitionDocuments documents) : IBillingRepository
{
    private const string C = Containers.Billing;
    private static string P(string id) => "billing:" + id;
    public Task<Versioned<Invoice>?> GetInvoiceAsync(string billingAccountId, string invoiceId, CancellationToken ct) => documents.ReadAsync<Invoice>(C, P(billingAccountId), "invoice:" + invoiceId, ct);
    public async Task<Invoice> CreateInvoiceAsync(Invoice invoice, Operation operation, CancellationToken ct)
    {
        var key = P(invoice.BillingAccountId);
        if (await documents.ReplayAsync<Invoice>(C, key, operation, ct) is { } prior)
            return prior;
        return await CommitOrReplay(documents.Batch(C, key).CreateItem(Row("invoice:" + invoice.Id, key, "invoice", invoice)).CreateItem(Receipt(key, operation, invoice)).CreateItem(Audit(key, operation, "billing.invoice_create", invoice.Id)), key, operation, invoice, ct);
    }

    public Task<IReadOnlyList<CashReceipt>> GetReceiptsAsync(string billingAccountId, string invoiceId, CancellationToken ct) => documents.QueryAsync<CashReceipt>(C, P(billingAccountId), StorageQuery.Type("cashReceipt").Where(StorageFilter.Eq("data.invoiceId", invoiceId)), ct);
    public async Task<CashReceipt> ReceiveCashAsync(string billingAccountId, string invoiceId, string version, CashReceipt receipt, Operation operation, CancellationToken ct)
    {
        var key = P(billingAccountId);
        if (await documents.ReplayAsync<CashReceipt>(C, key, operation, ct) is { } prior)
            return prior;
        var current = await GetInvoiceAsync(billingAccountId, invoiceId, ct) ?? throw new DomainException("invoice_not_found", "The invoice does not exist.", FailureKind.NotFound);
        if (receipt.InvoiceId != current.Value.Id || receipt.ParishId != current.Value.ParishId)
            throw new DomainException("receipt_mismatch", "Receipt does not match the invoice.");
        var updated = current.Value.Receive(receipt.Received.Amount, receipt.Received.Currency);
        var referenceHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(receipt.ReceiptReference.Normalize().ToUpperInvariant())));
        var batch = documents.Batch(C, key).ReplaceItem("invoice:" + invoiceId, Row("invoice:" + invoiceId, key, "invoice", updated), PartitionDocuments.Match(version)).CreateItem(Row("cash:" + receipt.Id, key, "cashReceipt", receipt)) // Paper reference uniqueness is per billing account, in the same atomic batch.
        .CreateItem(Row("cashReference:" + referenceHash, key, "cashReference", new { receipt.Id, receipt.InvoiceId })).CreateItem(Receipt(key, operation, receipt)).CreateItem(Audit(key, operation, "billing.cash_received", invoiceId, receipt.ReceiptReference));
        if (updated.Status == "Paid")
        {
            var coverage = new Coverage
            {
                Id = updated.Id,
                ParishId = updated.ParishId,
                InvoiceId = updated.Id,
                PlanId = updated.PlanId,
                Modules = updated.Modules,
                StartsAt = updated.StartsAt,
                EndsAt = updated.EndsAt,
                BillingAccountId = updated.BillingAccountId
            };
            batch.CreateItem(Row("activation:" + updated.Id, key, "activation", new ActivationWork { Id = updated.Id, Coverage = coverage, RecordedBy = operation.ActorId, CreatedAt = operation.At }));
        }

        return await CommitOrReplay(batch, key, operation, receipt, ct);
    }

    public async Task<string> GetActivationStatusAsync(string billingAccountId, string invoiceId, CancellationToken ct) => (await documents.ReadAsync<ActivationWork>(C, P(billingAccountId), "activation:" + invoiceId, ct))?.Value.Status ?? "AwaitingPayment";
    public async Task<IReadOnlyList<Versioned<ActivationWork>>> FindDueActivationsAsync(DateTimeOffset now, CancellationToken ct)
    {
        var query = StorageQuery.Type("activation").Where(StorageFilter.Or(StorageFilter.Eq("data.status", "Pending"), StorageFilter.And(StorageFilter.Eq("data.status", "Processing"), StorageFilter.Lt("data.leaseUntil", now))));
        return (await documents.QueryPageAsync<ActivationWork>(C, null, query, 25, null, ct)).Items;
    }

    public async Task<Versioned<ActivationWork>?> TryLeaseAsync(Versioned<ActivationWork> work, string owner, DateTimeOffset now, CancellationToken ct)
    {
        var key = P(work.Value.Coverage.BillingAccountId);
        var leased = new ActivationWork
        {
            Id = work.Value.Id,
            Coverage = work.Value.Coverage,
            RecordedBy = work.Value.RecordedBy,
            CreatedAt = work.Value.CreatedAt,
            Status = "Processing",
            LeaseOwner = owner,
            LeaseUntil = now.AddMinutes(2),
            LastErrorCode = work.Value.LastErrorCode
        };
        try
        {
            return await documents.ReplaceAsync(C, Row("activation:" + leased.Id, key, "activation", leased), work.Version, ct);
        }
        catch (DomainException ex) when (ex.Code == "write_conflict")
        {
            return null;
        }
    }

    public async Task CompleteActivationAsync(Versioned<ActivationWork> work, string status, string? errorCode, CancellationToken ct)
    {
        var key = P(work.Value.Coverage.BillingAccountId);
        var completed = new ActivationWork
        {
            Id = work.Value.Id,
            Coverage = work.Value.Coverage,
            RecordedBy = work.Value.RecordedBy,
            CreatedAt = work.Value.CreatedAt,
            Status = status,
            LeaseOwner = work.Value.LeaseOwner,
            LeaseUntil = null,
            LastErrorCode = errorCode
        };
        await documents.ReplaceAsync(C, Row("activation:" + completed.Id, key, "activation", completed), work.Version, ct);
    }

    private async Task<T> CommitOrReplay<T>(DocumentBatch batch, string key, Operation op, T result, CancellationToken ct)
        where T : class
    {
        try
        {
            await documents.CommitAsync(batch, ct);
            return result;
        }
        catch (DomainException ex) when (ex.Code == "write_conflict")
        {
            var replay = await documents.ReplayAsync<T>(C, key, op, ct);
            if (replay is not null)
                return replay;
            throw;
        }
    }
}
