// Purpose: Declares the IBillingRepository boundary used by backend services without exposing provider
// implementation details.
// Main functions: CreateInvoiceAsync, GetInvoiceAsync, GetReceiptsAsync, ReceiveCashAsync,
// GetActivationStatusAsync, FindDueActivationsAsync, TryLeaseAsync, CompleteActivationAsync, ListInvoicesAsync.

using ParishLife.Api.Models;

namespace ParishLife.Api.Interfaces.Repositories.Billing;

public interface IBillingRepository
{
    Task<Invoice> CreateInvoiceAsync(Invoice invoice, Operation operation, CancellationToken ct);
    Task<Versioned<Invoice>?> GetInvoiceAsync(string billingAccountId, string invoiceId, CancellationToken ct);
    Task<IReadOnlyList<CashReceipt>> GetReceiptsAsync(string billingAccountId, string invoiceId, CancellationToken ct);
    Task<CashReceipt> ReceiveCashAsync(string billingAccountId, string invoiceId, string version, CashReceipt receipt, Operation operation, CancellationToken ct);
    Task<string> GetActivationStatusAsync(string billingAccountId, string invoiceId, CancellationToken ct);
    Task<IReadOnlyList<Versioned<ActivationWork>>> FindDueActivationsAsync(DateTimeOffset now, CancellationToken ct);
    Task<Versioned<ActivationWork>?> TryLeaseAsync(Versioned<ActivationWork> work, string owner, DateTimeOffset now, CancellationToken ct);
    Task CompleteActivationAsync(Versioned<ActivationWork> work, string status, string? errorCode, CancellationToken ct);
    Task<IReadOnlyList<Invoice>> ListInvoicesAsync(string billingAccountId, CancellationToken ct);
}
