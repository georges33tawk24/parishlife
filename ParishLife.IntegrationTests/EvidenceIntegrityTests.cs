// Purpose: proves request evidence preserves concurrent case changes, immutable bytes and current authorization in isolated real storage.
// Main tests: stale upload/removal fences, staged and committed retries, bounded capacity, download integrity and applicant HTTP boundaries.
// Scenario and InterleavingRecords arrange actual services with deterministic read/commit interruptions; no production data or Azure is used.

using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Files;
using ParishLife.Api.DTOs.Requests;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Files;
using ParishLife.Api.Services.Requests;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class EvidenceIntegrityTests
{
    private static readonly byte[] Original = "%PDF-1.4 original"u8.ToArray();
    private static readonly byte[] Different = "%PDF-1.4 changed!"u8.ToArray();

    [Theory]
    [InlineData(false, "Declined")]
    [InlineData(false, "Received")]
    [InlineData(true, "Declined")]
    [InlineData(true, "Received")]
    public async Task Concurrent_case_change_is_never_overwritten_by_upload_or_removal(bool remove, string status)
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        f.As(s.Applicant, false);
        var file = remove ? await s.UploadAsync(Guid.NewGuid(), Original) : null;
        if (remove) f.As(f.FirstAdmin);
        var operation = Guid.NewGuid();
        var records = new InterleavingRecords(s.Records, afterRead: async id =>
        {
            if (id != "request:" + s.Request) return false;
            var row = (await s.Records.ReadAsync<ParishRequest>(s.Scope, id, default))!;
            row.Value.Status = status;
            row.Value.NextAction = "Concurrent office decision";
            await s.Records.CommitAsync(s.Scope, Operation.Create(Guid.NewGuid(), "isolated-operator", new { status }, f.Clock),
                "test.concurrent-case", s.Request, [RecordChange.Replace(id, "parishRequest", row.Value, row.Version)], new CommandResult(), default);
            return true;
        });
        var service = ActivatorUtilities.CreateInstance<EvidenceService>(f.Services, records);
        var error = await Assert.ThrowsAsync<DomainException>(async () =>
        {
            if (remove)
                await service.RemoveAsync(s.Parish, s.Request, file!.Id, new RemoveEvidenceDto
                { OperationId = operation, Version = file.Version, Reason = "Isolated removal" }, default);
            else
                await service.UploadAsync(s.Parish, s.Request, operation, "proof.pdf", "application/pdf", Original, null, null, default);
        });
        Assert.Equal("write_conflict", error.Code);
        Assert.True(records.Intercepted);
        var current = (await s.Records.ReadAsync<ParishRequest>(s.Scope, "request:" + s.Request, default))!.Value;
        Assert.Equal((status, "Concurrent office decision"), (current.Status, current.NextAction));
        var files = (await s.Records.PageAsync<EvidenceFile>(s.Scope, "evidenceFile", 100, null, default)).Items;
        if (remove) Assert.Equal("Active", Assert.Single(files).Value.Status);
        else Assert.Empty(files);
        Assert.Null(await s.Records.ReadAsync<object>(s.Scope, "operation:" + operation.ToString("N"), default));
    }

    [Fact]
    public async Task Staged_file_survives_failed_metadata_and_only_original_bytes_can_retry()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        f.As(s.Applicant, false);
        var operation = Guid.NewGuid();
        var interrupted = new CommitInterceptionRecords(s.Records, () => throw new IOException("Isolated metadata interruption"));
        var service = ActivatorUtilities.CreateInstance<EvidenceService>(f.Services, interrupted);
        await Assert.ThrowsAsync<IOException>(() => service.UploadAsync(s.Parish, s.Request, operation, "proof.pdf", "application/pdf", Original, null, null, default));
        var store = f.Services.GetRequiredService<IEvidenceStore>();
        var path = s.Parish + "/" + operation.ToString("N");
        Assert.Equal(Original, await store.OpenAsync(path, default));
        Assert.Empty((await s.Records.PageAsync<EvidenceFile>(s.Scope, "evidenceFile", 100, null, default)).Items);
        Assert.Equal(Original.Length, Different.Length);
        Assert.Equal("evidence_content_conflict", (await Assert.ThrowsAsync<DomainException>(() => s.UploadAsync(operation, Different))).Code);
        var recovered = await s.UploadAsync(operation, Original);
        Assert.Equal(Convert.ToHexString(SHA256.HashData(Original)), recovered.Sha256);
        Assert.Equal(Original, (await s.Files.DownloadAsync(s.Parish, s.Request, recovered.Id, default)).Content);
        Assert.Single((await s.Records.PageAsync<EvidenceFile>(s.Scope, "evidenceFile", 100, null, default)).Items);
    }

    [Fact]
    public async Task Legacy_v1_receipt_binds_bytes_and_replays_removed_file_without_new_mutation()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        f.As(s.Applicant, false);
        var operation = Guid.NewGuid();
        // Explicitly construct the pre-fix operation contract, rather than deriving it from the service under test.
        var request = s.Request;
        var fileName = "proof.pdf";
        var declaredType = "application/pdf";
        string? replaces = null, reason = null;
        var legacy = f.Services.GetRequiredService<ICurrentActor>().CreateOperation(operation,
            new { request, fileName, declaredType, size = Original.Length, replaces, reason }, f.Clock, "evidence:v1:" + request);
        var file = await s.UploadAsync(operation, Original);
        Assert.Equal(file.Id, (await s.Records.ReplayAsync<CommandResult>(s.Scope, legacy, default))!.Id);
        Assert.Equal("operation_reused", (await Assert.ThrowsAsync<DomainException>(() => s.UploadAsync(operation, Different))).Code);
        f.As(f.FirstAdmin);
        var removal = new RemoveEvidenceDto { OperationId = Guid.NewGuid(), Version = file.Version, Reason = "Wrong case" };
        await s.Files.RemoveAsync(s.Parish, s.Request, file.Id, removal, default);
        var closed = (await s.Records.ReadAsync<ParishRequest>(s.Scope, "request:" + s.Request, default))!;
        closed.Value.Status = "Declined";
        await s.Records.CommitAsync(s.Scope, Operation.Create(Guid.NewGuid(), f.FirstAdmin, new { closed = true }, f.Clock),
            "test.close", s.Request, [RecordChange.Replace("request:" + s.Request, "parishRequest", closed.Value, closed.Version)], new CommandResult(), default);
        var before = (await s.Records.ReadAsync<EvidenceFile>(s.Scope, "evidenceFile:" + file.Id, default))!.Version;
        f.As(s.Applicant, false);
        Assert.Equal("Removed", (await s.UploadAsync(operation, Original)).Status);
        Assert.Equal(before, (await s.Records.ReadAsync<EvidenceFile>(s.Scope, "evidenceFile:" + file.Id, default))!.Version);
        f.As(f.FirstAdmin);
        var another = await f.Services.GetRequiredService<RequestService>().SubmitAsync(s.Parish, new SubmitRequestDto
        { OperationId = Guid.NewGuid(), Origin = "Telephone", RequesterName = "Isolated", RequesterContact = "fixture@example.test", Kind = "General", Summary = "Another case" }, default);
        await Assert.ThrowsAsync<DomainException>(() => s.Files.RemoveAsync(s.Parish, another.Id, file.Id, removal, default));
    }

    [Fact]
    public async Task Competing_upload_at_twenty_file_limit_has_one_winner()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        f.As(s.Applicant, false);
        for (var i = 0; i < 19; i++) await s.UploadAsync(Guid.NewGuid(), Original);
        var records = new CommitInterceptionRecords(s.Records, async () => { await s.UploadAsync(Guid.NewGuid(), Original); });
        var service = ActivatorUtilities.CreateInstance<EvidenceService>(f.Services, records);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.UploadAsync(s.Parish, s.Request,
            Guid.NewGuid(), "proof.pdf", "application/pdf", Original, null, null, default))).Code);
        Assert.Equal(20, (await s.Files.ListAsync(s.Parish, s.Request, default)).Count(x => x.Status == "Active"));
        Assert.Equal("invalid_file_state", (await Assert.ThrowsAsync<DomainException>(() => s.UploadAsync(Guid.NewGuid(), Original))).Code);
        var replace = (await s.Files.ListAsync(s.Parish, s.Request, default)).First(x => x.Status == "Active");
        var replacement = await s.Files.UploadAsync(s.Parish, s.Request, Guid.NewGuid(), "better.pdf", "application/pdf", Different,
            replace.Id, "Clearer copy", default);
        var final = await s.Files.ListAsync(s.Parish, s.Request, default);
        Assert.Equal(20, final.Count(x => x.Status == "Active"));
        Assert.Equal("Replaced", final.Single(x => x.Id == replace.Id).Status);
        Assert.Equal("Active", final.Single(x => x.Id == replacement.Id).Status);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Authority_revoked_during_storage_IO_leaves_no_file_metadata_or_receipt(bool suspendParish)
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var applicant = (await users.FindByIdAsync(s.Applicant))!;
        f.As(s.Applicant, false);
        var operation = Guid.NewGuid();
        var store = f.Services.GetRequiredService<IEvidenceStore>();
        var intercepted = new AfterPutStore(store, async () =>
        {
            if (!suspendParish)
            {
                applicant.Active = false;
                Assert.True((await users.UpdateAsync(applicant)).Succeeded);
            }
            else
            {
                var root = (await s.Records.ReadAsync<Parish>(s.Scope, "parish", default))!;
                root.Value.Status = ParishStatus.Suspended;
                await s.Records.CommitAsync(s.Scope, Operation.Create(Guid.NewGuid(), "isolated-operator", new { suspended = true }, f.Clock),
                    "test.suspend", s.Parish, [RecordChange.Replace("parish", "parish", root.Value, root.Version)], new CommandResult(), default);
            }
        });
        var service = ActivatorUtilities.CreateInstance<EvidenceService>(f.Services, intercepted);
        await Assert.ThrowsAsync<DomainException>(() => service.UploadAsync(s.Parish, s.Request, operation, "proof.pdf", "application/pdf", Original, null, null, default));
        Assert.Equal(Original, await store.OpenAsync(s.Parish + "/" + operation.ToString("N"), default));
        Assert.Empty((await s.Records.PageAsync<EvidenceFile>(s.Scope, "evidenceFile", 100, null, default)).Items);
        Assert.Null(await s.Records.ReadAsync<object>(s.Scope, "operation:" + operation.ToString("N"), default));
    }

    [Theory]
    [InlineData("Suspended")]
    [InlineData("Closed")]
    [InlineData("ExpiredCoverage")]
    public async Task Applicant_requires_current_parish_and_module_even_for_replays_and_reads(string change)
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        f.As(s.Applicant, false);
        var operation = Guid.NewGuid();
        var file = await s.UploadAsync(operation, Original);
        if (change == "ExpiredCoverage") f.Clock.Now = f.Clock.Now.AddMonths(2);
        else
        {
            var root = (await s.Records.ReadAsync<Parish>(s.Scope, "parish", default))!;
            root.Value.Status = Enum.Parse<ParishStatus>(change);
            await s.Records.CommitAsync(s.Scope, Operation.Create(Guid.NewGuid(), "isolated-operator", new { change }, f.Clock), "test.parish-status", s.Parish,
                [RecordChange.Replace("parish", "parish", root.Value, root.Version)], new CommandResult(), default);
        }
        await Assert.ThrowsAsync<DomainException>(() => s.UploadAsync(operation, Original));
        await Assert.ThrowsAsync<DomainException>(() => s.UploadAsync(Guid.NewGuid(), Original));
        await Assert.ThrowsAsync<DomainException>(() => s.Files.ListAsync(s.Parish, s.Request, default));
        await Assert.ThrowsAsync<DomainException>(() => s.Files.DownloadAsync(s.Parish, s.Request, file.Id, default));
    }

    [Fact]
    public async Task Download_refuses_bytes_that_do_not_match_committed_hash()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        f.As(s.Applicant, false);
        var file = await s.UploadAsync(Guid.NewGuid(), Original);
        var service = ActivatorUtilities.CreateInstance<EvidenceService>(f.Services, new CorruptReadStore());
        var error = await Assert.ThrowsAsync<DomainException>(() => service.DownloadAsync(s.Parish, s.Request, file.Id, default));
        Assert.Equal(("evidence_integrity_unavailable", FailureKind.Unavailable), (error.Code, error.Kind));
    }

    [Fact]
    public async Task Applicant_HTTP_upload_requires_CSRF_and_preserves_ordinary_unlinked_access()
    {
        await using var f = new LocalBackendFixture();
        f.Clock.Now = DateTimeOffset.UtcNow;
        await f.InitializeAsync();
        var s = await Scenario.CreateAsync(f);
        var name = (await f.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(s.Applicant))!.UserName!;
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var client = factory.Client();
        await MinistryHttpTests.LoginAsync(client, name);
        var path = $"/api/parishes/{s.Parish}/requests/{s.Request}/files";
        // Login helper renews CSRF. Removing its header must still reject a multipart mutation.
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        using (var body = Multipart()) Assert.False((await client.PostAsync(path, body)).IsSuccessStatusCode);
        await MinistryHttpTests.CsrfAsync(client);
        using (var body = Multipart())
        {
            var saved = await MinistryHttpTests.ReadAsync<EvidenceFileDto>(await client.PostAsync(path, body));
            Assert.Equal(Original, await client.GetByteArrayAsync(path + "/" + saved.Id));
        }
        using var anonymous = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path)).StatusCode);
    }

    private static MultipartFormDataContent Multipart()
    {
        var body = new MultipartFormDataContent();
        body.Add(new StringContent(Guid.NewGuid().ToString()), "operationId");
        var bytes = new ByteArrayContent(Original);
        bytes.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        body.Add(bytes, "file", "proof.pdf");
        return body;
    }

    private sealed record Scenario(LocalBackendFixture F, string Parish, string Applicant, string Request)
    {
        public IRecordTransactions Records => F.Services.GetRequiredService<IRecordTransactions>();
        public EvidenceService Files => F.Services.GetRequiredService<EvidenceService>();
        public RecordScope Scope => new() { Area = RecordArea.Parish, OwnerId = Parish };
        public Task<EvidenceFileDto> UploadAsync(Guid operation, byte[] bytes)
            => Files.UploadAsync(Parish, Request, operation, "proof.pdf", "application/pdf", bytes, null, null, default);

        public static async Task<Scenario> CreateAsync(LocalBackendFixture f)
        {
            var staff = await StaffAppointmentScenario.CreateAsync(f);
            await staff.ActivateOfficeAsync(["core", "office", "requests"]);
            var applicant = await f.CreateVerifiedMemberAsync();
            f.As(applicant, false);
            var request = await f.Services.GetRequiredService<RequestService>().SubmitAsync(staff.Parish, new SubmitRequestDto
            { OperationId = Guid.NewGuid(), Kind = "General", Summary = "Isolated evidence case" }, default);
            return new Scenario(f, staff.Parish, applicant, request.Id);
        }
    }

    private sealed class CorruptReadStore : IEvidenceStore
    {
        public Task PutAsync(string path, byte[] content, string contentType, CancellationToken ct) => throw new NotSupportedException();
        public Task<byte[]?> OpenAsync(string path, CancellationToken ct) => Task.FromResult<byte[]?>(Different);
    }

    private sealed class AfterPutStore(IEvidenceStore inner, Func<Task> afterPut) : IEvidenceStore
    {
        public async Task PutAsync(string path, byte[] content, string contentType, CancellationToken ct)
        {
            await inner.PutAsync(path, content, contentType, ct);
            await afterPut();
        }
        public Task<byte[]?> OpenAsync(string path, CancellationToken ct) => inner.OpenAsync(path, ct);
    }

    private sealed class InterleavingRecords(IRecordTransactions inner, Func<string, Task<bool>> afterRead) : IRecordTransactions
    {
        public bool Intercepted { get; private set; }
        public async Task<Versioned<T>?> ReadAsync<T>(RecordScope scope, string id, CancellationToken ct)
        {
            var captured = await inner.ReadAsync<T>(scope, id, ct);
            if (!Intercepted) Intercepted = await afterRead(id);
            return captured;
        }
        public Task<Page<Versioned<T>>> PageAsync<T>(RecordScope scope, string type, int size, string? continuation, CancellationToken ct, params RecordCondition[] conditions)
            => inner.PageAsync<T>(scope, type, size, continuation, ct, conditions);
        public Task<Page<Versioned<T>>> ScanWorkAsync<T>(RecordArea area, string type, int size, string? continuation, CancellationToken ct)
            => inner.ScanWorkAsync<T>(area, type, size, continuation, ct);
        public Task<T?> ReplayAsync<T>(RecordScope scope, Operation operation, CancellationToken ct) where T : class => inner.ReplayAsync<T>(scope, operation, ct);
        public Task<T> CommitAsync<T>(RecordScope scope, Operation operation, string action, string resourceId, IReadOnlyList<RecordChange> changes, T result, CancellationToken ct, string? reason = null) where T : class
            => inner.CommitAsync(scope, operation, action, resourceId, changes, result, ct, reason);
    }
}
