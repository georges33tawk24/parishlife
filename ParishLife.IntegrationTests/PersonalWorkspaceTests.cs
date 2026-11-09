// Purpose: verifies account-private notes/tasks through actual isolated Identity, protected storage, transactions and HTTP.
// Main tests: original-content/history privacy, task lifecycle, conditional rollback/replay, account/cursor isolation,
// restricted/deactivated authentication, protected-payload substitution, and real cookie/CSRF/OpenAPI boundaries.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.DTOs.PersonalWorkspace;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.PersonalWorkspace;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class PersonalWorkspaceTests
{
    private const string Password = "isolated-fixture-long-password";
    private const string PrivateBody = "  نصّي الخاص\nOriginal private account content, preserved exactly.  ";
    private const string PathRoot = "/api/me/personal-workspace";

    [Fact]
    public async Task Draft_save_edit_and_history_preserve_original_text_and_encrypt_all_authored_details()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var owner = await f.CreateVerifiedMemberAsync();
        f.As(owner, false);
        var service = Service(f);
        var draft = await service.SaveAsync(null, new SavePersonalItemDto { OperationId = Guid.NewGuid(), SaveAsDraft = true }, default);
        Assert.Equal("Draft", draft.Value.Status);
        Assert.Null(draft.Value.Title);
        Assert.Empty(draft.Value.Body);
        var save = Note();
        save.Version = draft.Version;
        var saved = await service.SaveAsync(draft.Value.Id, save, default);
        Assert.Equal("Saved", saved.Value.Status);
        Assert.Equal("Only you", saved.Value.Audience);
        Assert.Equal(owner, saved.Value.OwnerAccountId);
        Assert.Equal(PrivateBody, saved.Value.Body);
        var edit = Note();
        edit.Version = saved.Version;
        edit.Body = "Another private original text";
        var edited = await service.SaveAsync(saved.Value.Id, edit, default);
        var history = await service.HistoryAsync(saved.Value.Id, 25, null, default);
        Assert.Equal(3, history.Items.Count);
        Assert.Contains(history.Items, row => row.Snapshot.Body == PrivateBody && row.Id == saved.Value.RevisionId);
        Assert.All(history.Items, row => Assert.Equal(owner, row.ActorId));
        Assert.NotEqual(saved.Version, edited.Version);
        var disk = string.Join("\n", Directory.EnumerateFiles(f.DirectoryPath, "*.json", SearchOption.AllDirectories).Select(File.ReadAllText));
        foreach (var text in new[] { PrivateBody, "Private isolated title", "Private isolated category", "Private isolated tag", edit.Body })
        {
            Assert.DoesNotContain(text, disk, StringComparison.Ordinal);
            Assert.DoesNotContain(JsonSerializer.Serialize(text)[1..^1], disk, StringComparison.Ordinal);
        }
        var safe = JsonSerializer.Serialize(new
        {
            Audit = await Records(f).PageAsync<JsonElement>(Scope(owner), "audit", 100, null, default),
            Receipt = await Records(f).PageAsync<JsonElement>(Scope(owner), "operation", 100, null, default)
        });
        Assert.DoesNotContain("ProtectedContent", safe);
        Assert.DoesNotContain("ProtectedRequest", safe);
        Assert.DoesNotContain("Private isolated", safe);
        Assert.DoesNotContain(PrivateBody, safe);
    }

    [Fact]
    public async Task Tasks_keep_actual_completion_history_on_reopen_and_archive_restore_without_completing_notes()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.As(f.Other);
        var service = Service(f);
        var draft = await service.SaveAsync(null, new SavePersonalItemDto { OperationId = Guid.NewGuid(), Kind = "Task", SaveAsDraft = true }, default);
        Assert.Equal("invalid_personal_item_state", (await Assert.ThrowsAsync<DomainException>(() => Act(service, draft, "cancel"))).Code);
        Assert.Equal("invalid_personal_item_state", (await Assert.ThrowsAsync<DomainException>(() => Act(service, draft, "complete"))).Code);
        Assert.Equal("Draft", (await service.GetAsync(draft.Value.Id, default)).Value.Status);
        var request = Note();
        request.Kind = "Task";
        request.DueAt = f.Clock.Now.AddDays(1);
        request.Priority = "High";
        request.PriorityReason = "Private isolated urgency";
        var item = await service.SaveAsync(null, request, default);
        Assert.Equal("Open", item.Value.Status);
        Assert.Equal(request.DueAt, item.Value.DueAt);
        item = await Act(service, item, "start");
        Assert.Equal("InProgress", item.Value.Status);
        item = await Act(service, item, "wait");
        Assert.Equal("Waiting", item.Value.Status);
        f.Clock.Now = f.Clock.Now.AddHours(2);
        item = await Act(service, item, "complete");
        var completed = item.Value.CompletedAt;
        Assert.Equal(f.Clock.Now, completed);
        item = await Act(service, item, "archive");
        Assert.Equal("Archived", item.Value.Status);
        item = await Act(service, item, "restore");
        Assert.Equal("Completed", item.Value.Status);
        Assert.Equal(completed, item.Value.CompletedAt);
        f.Clock.Now = f.Clock.Now.AddHours(1);
        item = await Act(service, item, "reopen");
        Assert.Equal("Open", item.Value.Status);
        Assert.Null(item.Value.CompletedAt);
        Assert.Equal(completed, item.Value.LastCompletedAt);
        var history = await service.HistoryAsync(item.Value.Id, 25, null, default);
        Assert.Contains(history.Items, row => row.Action == "complete" && row.Snapshot.CompletedAt == completed);
        Assert.Contains(history.Items, row => row.Action == "reopen" && row.PreviousStatus == "Completed" && row.Snapshot.LastCompletedAt == completed);
        item = await Act(service, item, "cancel");
        Assert.Equal("Cancelled", item.Value.Status);
        item = await Act(service, item, "reopen");
        Assert.Equal("Open", item.Value.Status);
        var note = await service.SaveAsync(null, Note(), default);
        Assert.Equal("invalid_personal_item_state", (await Assert.ThrowsAsync<DomainException>(() => Act(service, note, "complete"))).Code);
        Assert.Equal("Saved", (await service.GetAsync(note.Value.Id, default)).Value.Status);
    }

    [Fact]
    public async Task Stale_versions_and_concurrent_account_revocation_roll_back_content_history_and_receipts()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.As(f.Other);
        var service = Service(f);
        var created = await service.SaveAsync(null, Note(), default);
        var edit = Note();
        edit.Version = "stale";
        edit.Body = "A rejected private edit";
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(created.Value.Id, edit, default))).Code);
        Assert.Null(await Records(f).ReadAsync<JsonElement>(Scope(f.Other), "operation:" + edit.OperationId.ToString("N"), default));
        Assert.Single((await service.HistoryAsync(created.Value.Id, 25, null, default)).Items);
        var intercepted = new CommitInterceptionRecords(Records(f), async () =>
        {
            var users = f.Services.GetRequiredService<ParishUserManager>();
            var account = (await users.FindByIdAsync(f.Other))!;
            account.Active = false;
            Assert.True((await users.UpdateAsync(account)).Succeeded);
        });
        var concurrent = ActivatorUtilities.CreateInstance<PersonalWorkspaceService>(f.Services, intercepted);
        edit.OperationId = Guid.NewGuid();
        edit.Version = created.Version;
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => concurrent.SaveAsync(created.Value.Id, edit, default))).Code);
        var raw = (await Records(f).ReadAsync<PersonalWorkspaceItem>(Scope(f.Other), "personalWorkspaceItem:" + created.Value.Id, default))!;
        Assert.Equal(created.Version, raw.Version);
        Assert.Single((await Records(f).PageAsync<PersonalWorkspaceRevision>(Scope(f.Other), "personalWorkspaceRevision", 25, null, default)).Items);
        Assert.Null(await Records(f).ReadAsync<JsonElement>(Scope(f.Other), "operation:" + edit.OperationId.ToString("N"), default));
        Assert.Equal("account_unavailable", (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(created.Value.Id, default))).Code);
    }

    [Fact]
    public async Task Replays_report_current_state_and_compare_private_inputs_even_when_a_concurrent_duplicate_wins()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.As(f.Other);
        var service = Service(f);
        var request = Note();
        var item = await service.SaveAsync(null, request, default);
        var editedRequest = Note();
        editedRequest.Version = item.Version;
        editedRequest.Body = "Current edited private content";
        var edited = await service.SaveAsync(item.Value.Id, editedRequest, default);
        Assert.Equal(edited.Value.Body, (await service.SaveAsync(null, request, default)).Value.Body);
        request.Body = "Changed retry input";
        Assert.Equal("idempotency_conflict", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(null, request, default))).Code);
        var archive = new PersonalItemActionDto { OperationId = Guid.NewGuid(), Version = edited.Version, Action = "archive" };
        var archived = await service.ActAsync(item.Value.Id, archive, default);
        await Act(service, archived, "restore");
        Assert.Equal("Saved", (await service.ActAsync(item.Value.Id, archive, default)).Value.Status);
        var winner = Note();
        winner.Body = "Winner private original";
        var loser = Note();
        loser.OperationId = winner.OperationId;
        loser.Body = "Loser private original";
        var intercepted = new CommitInterceptionRecords(Records(f), async () => { await service.SaveAsync(null, winner, default); });
        var concurrent = ActivatorUtilities.CreateInstance<PersonalWorkspaceService>(f.Services, intercepted);
        Assert.Equal("idempotency_conflict", (await Assert.ThrowsAsync<DomainException>(() => concurrent.SaveAsync(null, loser, default))).Code);
        var current = await service.GetAsync(winner.OperationId.ToString("N"), default);
        Assert.Equal(winner.Body, current.Value.Body);
        Assert.Single((await service.HistoryAsync(current.Value.Id, 25, null, default)).Items);
    }

    [Fact]
    public async Task Other_accounts_including_platform_admins_cannot_read_mutate_or_reuse_private_page_cursors()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var owner = await f.CreateVerifiedMemberAsync();
        f.As(owner, false);
        var service = Service(f);
        var first = await service.SaveAsync(null, Note(), default);
        await service.SaveAsync(null, Note(), default);
        await service.SaveAsync(null, Note(), default);
        var page = await service.ListAsync(1, null, "Note", "Saved", default);
        Assert.NotNull(page.ContinuationToken);
        var second = await service.ListAsync(1, page.ContinuationToken, "Note", "Saved", default);
        Assert.NotEqual(page.Items[0].Value.Id, second.Items[0].Value.Id);
        Assert.Equal("invalid_cursor", (await Assert.ThrowsAsync<DomainException>(() => service.ListAsync(1, page.ContinuationToken, "Task", "Open", default))).Code);
        foreach (var outsider in new[] { f.Other, f.FirstAdmin })
        {
            f.As(outsider);
            Assert.Empty((await service.ListAsync(25, null, null, null, default)).Items);
            Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(first.Value.Id, default))).Code);
            Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => service.HistoryAsync(first.Value.Id, 25, null, default))).Code);
            var edit = Note();
            edit.Version = first.Version;
            Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(first.Value.Id, edit, default))).Code);
            Assert.Equal("resource_not_found", (await Assert.ThrowsAsync<DomainException>(() => Act(service, first, "archive"))).Code);
            Assert.Equal("invalid_cursor", (await Assert.ThrowsAsync<DomainException>(() => service.ListAsync(1, page.ContinuationToken, "Note", "Saved", default))).Code);
        }
    }

    [Fact]
    public async Task Personal_boundaries_and_validation_hold_without_receipts_or_fabricated_reminders()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.As(f.Other);
        var service = Service(f);
        var note = await service.SaveAsync(null, Note(), default);
        f.AsRecovery(f.Other);
        Assert.Equal("personal_workspace_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(note.Value.Id, default))).Code);
        Assert.Equal("personal_workspace_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(null, Note(), default))).Code);
        f.AsAppointment(f.Other, Guid.NewGuid().ToString("N"));
        Assert.Equal("personal_workspace_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => service.ListAsync(25, null, null, null, default))).Code);
        Assert.Equal("personal_workspace_capacity_required", (await Assert.ThrowsAsync<DomainException>(() => Act(service, note, "archive"))).Code);
        f.As(f.Other);
        var invalid = Note();
        invalid.Body = " ";
        Assert.Equal("invalid_personal_item", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(null, invalid, default))).Code);
        invalid = Note();
        invalid.DueAt = f.Clock.Now;
        Assert.Equal("invalid_personal_item", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(null, invalid, default))).Code);
        invalid = Note();
        invalid.Kind = "Task";
        invalid.Priority = "High";
        Assert.Equal("invalid_personal_item", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(null, invalid, default))).Code);
        invalid.PriorityReason = "Private supplied priority reason";
        invalid.DueAt = f.Clock.Now.ToOffset(TimeSpan.FromHours(2));
        Assert.Equal("invalid_instant", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(null, invalid, default))).Code);
        invalid = Note();
        invalid.Tags = Enumerable.Repeat("duplicate", 2).ToArray();
        Assert.Equal("invalid_personal_item", (await Assert.ThrowsAsync<DomainException>(() => service.SaveAsync(null, invalid, default))).Code);
        Assert.Single((await Records(f).PageAsync<JsonElement>(Scope(f.Other), "operation", 100, null, default)).Items);
        Assert.Empty((await Records(f).PageAsync<JsonElement>(Scope(f.Other), "notificationWork", 100, null, default)).Items);
        var users = f.Services.GetRequiredService<ParishUserManager>();
        var account = (await users.FindByIdAsync(f.Other))!;
        account.LockoutEnabled = true;
        account.LockoutEnd = DateTimeOffset.UtcNow.AddMinutes(5);
        Assert.True((await users.UpdateAsync(account)).Succeeded);
        Assert.Equal("account_unavailable", (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(note.Value.Id, default))).Code);
    }

    [Fact]
    public async Task Protected_content_cannot_be_substituted_between_personal_items()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        f.As(f.Other);
        var service = Service(f);
        var first = await service.SaveAsync(null, Note(), default);
        var second = await service.SaveAsync(null, Note(), default);
        var scope = Scope(f.Other);
        var records = Records(f);
        var one = (await records.ReadAsync<PersonalWorkspaceItem>(scope, "personalWorkspaceItem:" + first.Value.Id, default))!;
        var two = (await records.ReadAsync<PersonalWorkspaceItem>(scope, "personalWorkspaceItem:" + second.Value.Id, default))!;
        one.Value.ProtectedContent = two.Value.ProtectedContent;
        await records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), f.Other, new { Kind = "isolated-invalid-payload-fixture" }, f.Clock),
            "fixture.invalid_payload", first.Value.Id,
            [RecordChange.Replace("personalWorkspaceItem:" + first.Value.Id, "personalWorkspaceItem", one.Value, one.Version)], new CommandResult(), default);
        Assert.Equal("personal_content_unavailable", (await Assert.ThrowsAsync<DomainException>(() => service.GetAsync(first.Value.Id, default))).Code);
        Assert.Equal(PrivateBody, (await service.GetAsync(second.Value.Id, default)).Value.Body);
    }

    [Fact]
    public async Task Http_uses_personal_cookies_csrf_no_store_and_no_admin_or_recovery_content_access()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        var user = (await f.Services.GetRequiredService<ParishUserManager>().FindByIdAsync(member))!;
        f.As(f.Other);
        var codes = await f.Services.GetRequiredService<MfaSecurityService>().RegenerateAsync(new RegenerateRecoveryCodesDto
        { OperationId = Guid.NewGuid(), CurrentPassword = Password, CurrentCode = TestAuthenticator.Code() }, default);
        await using var factory = new LocalApiFactory(f.DirectoryPath);
        using var owner = factory.Client();
        using var other = factory.Client();
        using var recovery = factory.Client();
        using var anonymous = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(PathRoot)).StatusCode);
        await Login(owner, user.UserName!, false);
        owner.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PostAsJsonAsync(PathRoot, Note())).StatusCode);
        await Csrf(owner);
        var createdResponse = await owner.PostAsJsonAsync(PathRoot, Note());
        Assert.Contains("no-store", createdResponse.Headers.CacheControl!.ToString());
        var item = await Read<Versioned<PersonalItemDto>>(createdResponse);
        var path = PathRoot + "/" + item.Value.Id;
        Assert.Equal(PrivateBody, (await Read<Versioned<PersonalItemDto>>(await owner.GetAsync(path))).Value.Body);
        Assert.Equal(HttpStatusCode.BadRequest, (await owner.PutAsJsonAsync(path, new SavePersonalItemDto
        { OperationId = Guid.NewGuid(), Version = item.Version, Kind = "Shared", Body = "Rejected" })).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await owner.DeleteAsync(path)).StatusCode);
        await Login(other, "colinsleiman", true);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync(path)).StatusCode);
        Assert.Empty((await Read<Page<Versioned<PersonalItemDto>>>(await other.GetAsync(PathRoot))).Items);
        owner.DefaultRequestHeaders.Add("X-ParishLife-Appointment", Guid.NewGuid().ToString("N"));
        Assert.Equal(HttpStatusCode.Forbidden, (await owner.GetAsync(path)).StatusCode);
        owner.DefaultRequestHeaders.Remove("X-ParishLife-Appointment");
        await Csrf(recovery);
        var challenge = (await Read<JsonElement>(await recovery.PostAsJsonAsync("/api/auth/login", new { username = "other@fixture.example", password = Password }))).GetProperty("challenge");
        await Read<RecoverySignInDto>(await recovery.PostAsJsonAsync("/api/auth/login/mfa/recovery", new CompleteRecoveryLoginDto
        { AccountId = Guid.Parse(f.Other), Challenge = challenge.GetProperty("challenge").GetString()!, RecoveryCode = codes.RecoveryCodes[0] }));
        Assert.Equal(HttpStatusCode.Forbidden, (await recovery.GetAsync(PathRoot)).StatusCode);
        var schemas = (await Read<JsonElement>(await owner.GetAsync("/openapi/v1.json"))).GetProperty("components").GetProperty("schemas");
        Assert.True(schemas.TryGetProperty("SavePersonalItemDto", out _));
        Assert.True(schemas.TryGetProperty("PersonalItemDto", out _));
        Assert.False(schemas.TryGetProperty("PersonalWorkspaceItem", out _));
        Assert.False(schemas.TryGetProperty("PersonalWorkspaceContent", out _));
        Assert.False(schemas.TryGetProperty("PersonalWorkspaceCommand", out _));
        var changed = await Read<Versioned<PersonalItemDto>>(await owner.PostAsJsonAsync(path + "/actions",
            new PersonalItemActionDto { OperationId = Guid.NewGuid(), Version = item.Version, Action = "archive" }));
        Assert.Equal("Archived", changed.Value.Status);
        Assert.Equal(2, (await Read<Page<PersonalItemRevisionDto>>(await owner.GetAsync(path + "/history"))).Items.Count);
        await owner.PostAsJsonAsync("/api/auth/logout", new { });
        Assert.Equal(HttpStatusCode.Unauthorized, (await owner.GetAsync(path)).StatusCode);
    }

    private static PersonalWorkspaceService Service(LocalBackendFixture f) => f.Services.GetRequiredService<PersonalWorkspaceService>();
    private static IRecordTransactions Records(LocalBackendFixture f) => f.Services.GetRequiredService<IRecordTransactions>();
    private static RecordScope Scope(string owner) => new() { Area = RecordArea.Account, OwnerId = owner };
    private static SavePersonalItemDto Note() => new()
    {
        OperationId = Guid.NewGuid(),
        Body = PrivateBody,
        Title = "Private isolated title",
        Category = "Private isolated category",
        Tags = ["Private isolated tag"]
    };
    private static Task<Versioned<PersonalItemDto>> Act(PersonalWorkspaceService service, Versioned<PersonalItemDto> item, string action)
        => service.ActAsync(item.Value.Id, new PersonalItemActionDto { OperationId = Guid.NewGuid(), Version = item.Version, Action = action }, default);
    private static async Task Login(HttpClient client, string username, bool mfa)
    {
        await Csrf(client);
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username, password = Password });
        if (mfa)
        {
            var challenge = (await Read<JsonElement>(response)).GetProperty("challenge");
            await Read<AccountDto>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
            { accountId = challenge.GetProperty("accountId").GetString(), challenge = challenge.GetProperty("challenge").GetString(), code = TestAuthenticator.Code() }));
        }
        else
            await Read<AccountDto>(response);
        await Csrf(client);
    }
    private static async Task Csrf(HttpClient client)
    {
        var response = await Read<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", response.GetProperty("token").GetString());
    }
    private static async Task<T> Read<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
}
