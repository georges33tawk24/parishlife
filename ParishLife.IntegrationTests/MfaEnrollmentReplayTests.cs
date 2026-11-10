// Purpose: deterministically verifies a duplicate enrollment that observes a receipt committed after its earlier enrollment read.
// Main test: replay reloads the committed pending enrollment and returns its key without creating another credential or receipt.
// ReplayArrivalRecords delegates real persistence while inserting the competing completed start at the exact receipt boundary.

using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class MfaEnrollmentReplayTests
{
    [Fact]
    public async Task Duplicate_start_reloads_enrollment_when_receipt_arrives_after_its_initial_snapshot()
    {
        await using var fixture = new LocalBackendFixture();
        await fixture.InitializeAsync();
        var member = await fixture.CreateVerifiedMemberAsync();
        fixture.As(member, false);
        var service = fixture.Services.GetRequiredService<MfaSecurityService>();
        var records = fixture.Services.GetRequiredService<IRecordTransactions>();
        var request = new BeginMfaEnrollmentDto
        { OperationId = Guid.NewGuid(), CurrentPassword = "isolated-fixture-long-password" };
        MfaEnrollmentDto? committed = null;
        var interleaving = new ReplayArrivalRecords(records, request.OperationId.ToString("N"), async () =>
        {
            committed = await service.BeginAsync(request, default);
        });
        var duplicate = ActivatorUtilities.CreateInstance<MfaSecurityService>(fixture.Services, interleaving);
        var result = await duplicate.BeginAsync(request, default);
        Assert.True(interleaving.ObservedEarlierEmptyEnrollment);
        Assert.NotNull(committed);
        Assert.Equal(committed.EnrollmentId, result.EnrollmentId);
        Assert.Equal(committed.SharedKey, result.SharedKey);
        var scope = new RecordScope { Area = RecordArea.Account, OwnerId = member };
        var row = (await records.ReadAsync<MfaEnrollment>(scope, "mfaEnrollment", default))!;
        Assert.Equal(result.EnrollmentId, row.Value.Id);
        Assert.Equal("Pending", row.Value.Status);
        Assert.Single((await records.PageAsync<JsonElement>(scope, "operation", 100, null, default)).Items);
    }

    private sealed class ReplayArrivalRecords(IRecordTransactions inner, string operationId, Func<Task> beforeReplay) : IRecordTransactions
    {
        private bool arrived;
        public bool ObservedEarlierEmptyEnrollment { get; private set; }

        public async Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct)
        {
            var row = await inner.ReadAsync<T>(scope, id, ct);
            if (!arrived && id == "mfaEnrollment" && row is null)
                ObservedEarlierEmptyEnrollment = true;
            return row;
        }

        public Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? continuation,
            CancellationToken ct, params RecordCondition[] conditions)
            => inner.PageAsync<T>(scope, type, size, continuation, ct, conditions);

        public Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? continuation, CancellationToken ct)
            => inner.ScanWorkAsync<T>(area, type, size, continuation, ct);

        public async Task<T?> ReplayAsync<T>(RecordScope scope, Operation operation, CancellationToken ct) where T : class
        {
            if (!arrived && operation.Id == operationId)
            {
                arrived = true;
                await beforeReplay();
            }
            return await inner.ReplayAsync<T>(scope, operation, ct);
        }

        public Task<T> CommitAsync<T>(RecordScope scope, Operation operation, string action, string resourceId,
            IReadOnlyList<RecordChange> changes, T result, CancellationToken ct, string? reason = null) where T : class
            => inner.CommitAsync(scope, operation, action, resourceId, changes, result, ct, reason);
    }
}
