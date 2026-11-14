// Purpose: verifies the administration area's platform lists, account suspension, clergy titles and parish audit trail through the real local
// services, Identity accounts and isolated storage, plus the HTTP routes with real cookies, MFA and CSRF.
// Main tests: lists are operator-only, filtered, paged, audited and credential-free; suspension keeps data, ends sessions, blocks sign-in,
// replays exactly, refuses stale versions, self and operator targets, and is reversible only by reinstatement; clergy titles start empty and
// only operators maintain or assign them; the parish audit trail needs audit.read and omits reasons; HTTP routes enforce the same rules.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Administration;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Administration;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class PlatformAdministrationTests
{
    private const string Password = "isolated-fixture-long-password";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private static async Task<string> RegisterParishAsync(LocalBackendFixture f, string name, string locality)
    {
        f.As(f.FirstAdmin);
        return (await f.Services.GetRequiredService<ParishService>().RegisterAsync(new RegisterParishDto
        {
            OperationId = Guid.NewGuid(), Name = name, Locality = locality, Contact = "fixture.example"
        }, default)).Id;
    }

    private static AccountStatusActionDto Action(string version, string reason = "Isolated suspension reason")
        => new() { OperationId = Guid.NewGuid(), Version = version, Reason = reason };

    private static IEnumerable<Action> Denied(LocalBackendFixture f, string member) =>
    [
        () => f.As(f.Nominee),
        () => f.As(member, mfa: false),
        () => f.As(f.FirstAdmin, mfa: false),
        () => f.AsRecovery(f.FirstAdmin)
    ];

    [Fact]
    public async Task Operators_list_parishes_archdioceses_and_safe_accounts_with_filters_paging_and_audit()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var first = await RegisterParishAsync(f, "Alpha isolated parish", "North fixture town");
        var second = await RegisterParishAsync(f, "Beta isolated parish", "South fixture town");
        var organization = await f.OrganizationAsync();
        var member = await f.CreateVerifiedMemberAsync();
        var directory = f.Services.GetRequiredService<PlatformDirectoryService>();

        f.As(f.FirstAdmin);
        var parishes = await directory.ParishesAsync(null, null, 50, null, default);
        Assert.Contains(parishes.Items, p => p.Id == first);
        Assert.Contains(parishes.Items, p => p.Id == second);
        Assert.Equal([second], (await directory.ParishesAsync("south", null, 50, null, default)).Items.Select(p => p.Id).ToArray());
        Assert.Empty((await directory.ParishesAsync(null, "Closed", 50, null, default)).Items);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => directory.ParishesAsync(null, "Nonsense", 50, null, default))).Code);

        // Paging follows a plain offset cursor until the list ends; a malformed cursor or page size is refused.
        var page = await directory.ParishesAsync("isolated parish", null, 1, null, default);
        Assert.Single(page.Items);
        var next = await directory.ParishesAsync("isolated parish", null, 1, page.ContinuationToken, default);
        Assert.Single(next.Items);
        Assert.NotEqual(page.Items[0].Id, next.Items[0].Id);
        Assert.Equal("invalid_cursor", (await Assert.ThrowsAsync<DomainException>(() => directory.ParishesAsync(null, null, 1, "x", default))).Code);
        Assert.Equal("invalid_page", (await Assert.ThrowsAsync<DomainException>(() => directory.ParishesAsync(null, null, 101, null, default))).Code);

        f.As(f.FirstAdmin);
        Assert.Contains((await directory.ArchdiocesesAsync(null, 50, null, default)).Items, a => a.Id == organization);

        var accounts = await directory.AccountsAsync(null, null, 100, null, default);
        Assert.Contains(accounts.Items, a => a.Value.AccountId == member && a.Value.Status == "Active" && !a.Value.PlatformOperator);
        Assert.Contains(accounts.Items, a => a.Value.AccountId == f.FirstAdmin && a.Value.PlatformOperator);
        Assert.All(accounts.Items, a => Assert.False(string.IsNullOrEmpty(a.Version)));
        // The safe view never carries credentials, recovery data or key material.
        var raw = JsonSerializer.Serialize(accounts, Json);
        foreach (var secret in new[] { "passwordHash", "securityStamp", "authenticatorKey", "protectedRecoveryCodes", "passkeys", "externalLogins", "contactVerificationReference", "AAAAAAAAAAAAAAAA" })
            Assert.DoesNotContain(secret, raw, StringComparison.OrdinalIgnoreCase);
        Assert.Equal([member], (await directory.AccountsAsync(member, null, 50, null, default)).Items.Select(a => a.Value.AccountId).ToArray());
        Assert.Empty((await directory.AccountsAsync(null, "Suspended", 50, null, default)).Items);
        var single = await directory.AccountAsync(member, default);
        Assert.Equal(("Active", member), (single.Value.Status, single.Value.AccountId));
        Assert.Equal(FailureKind.NotFound, (await Assert.ThrowsAsync<DomainException>(() => directory.AccountAsync(Guid.NewGuid().ToString("N"), default))).Kind);

        // Each read leaves an audit row in the reading operator's own platform partition.
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var audit = await records.PageAsync<AuditRecord>(new RecordScope { Area = RecordArea.Platform, OwnerId = "directory-reads:" + f.FirstAdmin }, "audit", 100, null, default);
        Assert.Contains(audit.Items, r => r.Value.Action == "platform.directory.read" && r.Value.ResourceId == "accounts" && r.Value.ActorId == f.FirstAdmin);
        Assert.Contains(audit.Items, r => r.Value.ResourceId == "account:" + member);

        foreach (var denied in Denied(f, member))
        {
            denied();
            await Assert.ThrowsAnyAsync<DomainException>(() => directory.ParishesAsync(null, null, 50, null, default));
            await Assert.ThrowsAnyAsync<DomainException>(() => directory.ArchdiocesesAsync(null, 50, null, default));
            await Assert.ThrowsAnyAsync<DomainException>(() => directory.AccountsAsync(null, null, 50, null, default));
            await Assert.ThrowsAnyAsync<DomainException>(() => directory.AccountAsync(member, default));
        }
    }

    [Fact]
    public async Task Suspension_keeps_data_ends_sessions_blocks_sign_in_and_only_reinstatement_restores_the_account()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        var users = f.Services.GetRequiredService<UserManager<ParishUser>>();
        var sessions = f.Services.GetRequiredService<AccountSessionService>();
        var accounts = f.Services.GetRequiredService<IAccountDirectory>();
        var status = f.Services.GetRequiredService<AccountStatusService>();
        var directory = f.Services.GetRequiredService<PlatformDirectoryService>();
        var target = (await users.FindByIdAsync(member))!;
        var session = await sessions.CreateAsync(target, default);
        Assert.True(await sessions.ValidAsync(member, session.Id, session.SecurityStamp, default));

        f.As(f.FirstAdmin);
        var version = (await directory.AccountAsync(member, default)).Version;
        foreach (var denied in Denied(f, f.Other))
        {
            denied();
            await Assert.ThrowsAnyAsync<DomainException>(() => status.SuspendAsync(member, Action(version), default));
            await Assert.ThrowsAnyAsync<DomainException>(() => status.HistoryAsync(member, 25, null, default));
        }

        f.As(f.FirstAdmin);
        // Operators cannot suspend themselves or another operator account; a stale version conflicts; nothing is written.
        Assert.Equal("independent_operator_required", (await Assert.ThrowsAsync<DomainException>(() => status.SuspendAsync(f.FirstAdmin, Action("any"), default))).Code);
        var operatorVersion = (await directory.AccountAsync(f.SecondAdmin, default)).Version;
        Assert.Equal("operator_account_protected", (await Assert.ThrowsAsync<DomainException>(() => status.SuspendAsync(f.SecondAdmin, Action(operatorVersion), default))).Code);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => status.SuspendAsync(member, Action("\"stale\""), default))).Code);
        Assert.Equal("invalid_state", (await Assert.ThrowsAsync<DomainException>(() => status.ReinstateAsync(member, Action(version), default))).Code);
        Assert.Empty((await status.HistoryAsync(member, 25, null, default)).Items);

        var request = Action(version, "Isolated suspension evidence");
        var suspended = await status.SuspendAsync(member, request, default);
        Assert.Equal(("Suspended", f.FirstAdmin, "Isolated suspension evidence"), (suspended.Action, suspended.By, suspended.Reason));
        Assert.Equal(suspended.Id, (await status.SuspendAsync(member, request, default)).Id);
        Assert.Single((await status.HistoryAsync(member, 25, null, default)).Items);

        // The account still exists with its data, but sessions end, sign-in lookups and eligibility checks refuse it.
        var stored = await directory.AccountAsync(member, default);
        Assert.Equal("Suspended", stored.Value.Status);
        Assert.False(await sessions.ValidAsync(member, session.Id, session.SecurityStamp, default));
        Assert.Null(await users.FindByNameAsync(target.NormalizedUserName!));
        Assert.False(await accounts.IsActiveVerifiedAsync(member, default));
        Assert.Contains((await directory.AccountsAsync(null, "Suspended", 50, null, default)).Items, a => a.Value.AccountId == member);
        Assert.Equal("invalid_state", (await Assert.ThrowsAsync<DomainException>(() => status.SuspendAsync(member, Action(stored.Version), default))).Code);

        // The status change is audited in the account partition with the operator, action and reason.
        var records = f.Services.GetRequiredService<IRecordTransactions>();
        var audit = await records.ReadAsync<AuditRecord>(new RecordScope { Area = RecordArea.Account, OwnerId = member }, "audit:" + suspended.Id, default);
        Assert.Equal(("account.suspended", f.FirstAdmin, member), (audit!.Value.Action, audit.Value.ActorId, audit.Value.ResourceId));

        f.Clock.Now = f.Clock.Now.AddMinutes(5);
        var reinstated = await status.ReinstateAsync(member, Action(stored.Version, "Isolated reinstatement"), default);
        Assert.Equal("Reinstated", reinstated.Action);
        Assert.Equal("Active", (await directory.AccountAsync(member, default)).Value.Status);
        Assert.True(await accounts.IsActiveVerifiedAsync(member, default));
        // The session open before the suspension never comes back: the security stamp was rotated.
        Assert.False(await sessions.ValidAsync(member, session.Id, session.SecurityStamp, default));
        Assert.NotNull(await users.FindByNameAsync(target.NormalizedUserName!));
        Assert.Equal(["Reinstated", "Suspended"], (await status.HistoryAsync(member, 25, null, default)).Items.Select(i => i.Action).ToArray());
    }

    [Fact]
    public async Task Clergy_titles_start_empty_and_only_operators_maintain_and_assign_them()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var member = await f.CreateVerifiedMemberAsync();
        var titles = f.Services.GetRequiredService<ClergyTitleService>();

        f.As(member, mfa: false);
        Assert.Empty(await titles.ListAsync(true, default));
        await Assert.ThrowsAnyAsync<DomainException>(() => titles.CreateAsync(new ClergyTitleSaveDto { OperationId = Guid.NewGuid(), Title = "Isolated title" }, default));

        f.As(f.FirstAdmin);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => titles.CreateAsync(new ClergyTitleSaveDto { OperationId = Guid.NewGuid(), Title = " " }, default))).Code);
        var request = new ClergyTitleSaveDto { OperationId = Guid.NewGuid(), TitleAr = "لقب تجريبي" };
        var created = await titles.CreateAsync(request, default);
        Assert.Equal(("", "لقب تجريبي"), (created.Value.Title, created.Value.TitleAr));
        Assert.Equal(created.Value.Id, (await titles.CreateAsync(request, default)).Value.Id);
        var updated = await titles.UpdateAsync(created.Value.Id, new ClergyTitleSaveDto { OperationId = Guid.NewGuid(), Version = created.Version, Title = "Isolated title", TitleAr = "لقب تجريبي" }, default);
        Assert.Equal("Isolated title", updated.Value.Title);
        Assert.Equal("write_conflict", (await Assert.ThrowsAsync<DomainException>(() => titles.UpdateAsync(created.Value.Id, new ClergyTitleSaveDto { OperationId = Guid.NewGuid(), Version = created.Version, Title = "Stale" }, default))).Code);

        var assigned = await titles.AssignAsync(member, new ClergyTitleAssignDto { OperationId = Guid.NewGuid(), ClergyTitleId = Guid.Parse(created.Value.Id) }, default);
        Assert.Equal(("Isolated title", "لقب تجريبي"), (assigned.Value.Title, assigned.Value.TitleAr));
        f.As(f.Other);
        Assert.Equal(created.Value.Id, (await titles.AssignmentAsync(member, default)).Value.ClergyTitleId);
        Assert.Null((await titles.AssignmentAsync(f.Nominee, default)).Value.ClergyTitleId);
        await Assert.ThrowsAnyAsync<DomainException>(() => titles.AssignAsync(member, new ClergyTitleAssignDto { OperationId = Guid.NewGuid(), Version = assigned.Version }, default));

        // A retired title disappears from the default list and cannot be assigned again.
        f.As(f.FirstAdmin);
        await titles.UpdateAsync(created.Value.Id, new ClergyTitleSaveDto { OperationId = Guid.NewGuid(), Version = updated.Version, Title = "Isolated title", Retired = true }, default);
        Assert.Empty(await titles.ListAsync(false, default));
        Assert.Single(await titles.ListAsync(true, default));
        Assert.Equal("clergy_title_retired", (await Assert.ThrowsAsync<DomainException>(() => titles.AssignAsync(f.Other, new ClergyTitleAssignDto { OperationId = Guid.NewGuid(), ClergyTitleId = Guid.Parse(created.Value.Id) }, default))).Code);
        var cleared = await titles.AssignAsync(member, new ClergyTitleAssignDto { OperationId = Guid.NewGuid(), Version = assigned.Version }, default);
        Assert.Null(cleared.Value.ClergyTitleId);
    }

    [Fact]
    public async Task Parish_audit_trail_needs_audit_read_and_never_returns_reasons()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var auditor = await GrantAsync(staff, Permissions.AuditRead);
        var reader = await GrantAsync(staff, Permissions.PeopleRead);
        var audit = f.Services.GetRequiredService<ParishAuditService>();

        f.As(auditor);
        var page = await audit.PageAsync(staff.Parish, 100, null, default);
        Assert.Contains(page.Items, e => e.Action.Contains("grant", StringComparison.OrdinalIgnoreCase) && e.ActorId == f.FirstAdmin);
        Assert.All(page.Items, e => Assert.False(string.IsNullOrEmpty(e.Action)));
        Assert.DoesNotContain("reason", JsonSerializer.Serialize(page, Json), StringComparison.OrdinalIgnoreCase);
        Assert.Equal("invalid_page", (await Assert.ThrowsAsync<DomainException>(() => audit.PageAsync(staff.Parish, 101, null, default))).Code);

        f.As(reader);
        var refused = await Assert.ThrowsAsync<DomainException>(() => audit.PageAsync(staff.Parish, 50, null, default));
        Assert.Contains(refused.Kind, new[] { FailureKind.Forbidden, FailureKind.NotFound });
        f.As(f.Nominee, mfa: false);
        await Assert.ThrowsAnyAsync<DomainException>(() => audit.PageAsync(staff.Parish, 50, null, default));
    }

    private static async Task<string> GrantAsync(StaffAppointmentScenario staff, string permission)
    {
        var account = await staff.Fixture.CreateVerifiedStaffAsync();
        staff.Fixture.As(staff.Fixture.FirstAdmin);
        await staff.Fixture.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(account), Allows = [permission], StartsAt = staff.Fixture.Clock.Now
        }, default);
        return account;
    }

    [Fact]
    public async Task Http_routes_enforce_operator_mfa_csrf_and_return_safe_accounts()
    {
        await using var fixture = new LocalBackendFixture();
        fixture.Clock.Now = DateTimeOffset.UtcNow;
        await fixture.InitializeAsync();
        var member = await fixture.CreateVerifiedMemberAsync();
        await using var factory = new LocalApiFactory(fixture.DirectoryPath);
        using var operatorClient = factory.Client();
        using var nominee = factory.Client();
        await SignInAsync(operatorClient, "colinsleiman");
        await SignInAsync(nominee, "nominee@fixture.example");

        var listing = await operatorClient.GetAsync("/api/administration/accounts?size=100");
        var text = await listing.Content.ReadAsStringAsync();
        Assert.True(listing.IsSuccessStatusCode, text);
        Assert.Contains(member, text);
        Assert.DoesNotContain("passwordHash", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("securityStamp", text, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.OK, (await operatorClient.GetAsync("/api/administration/parishes")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await operatorClient.GetAsync("/api/administration/archdioceses")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await operatorClient.GetAsync("/api/clergy-titles")).StatusCode);
        foreach (var path in new[] { "/api/administration/accounts", "/api/administration/parishes", "/api/administration/archdioceses", $"/api/administration/accounts/{member}" })
            Assert.Equal(HttpStatusCode.Forbidden, (await nominee.GetAsync(path)).StatusCode);

        var account = await ReadAsync<Versioned<PlatformAccountDto>>(await operatorClient.GetAsync($"/api/administration/accounts/{member}"));
        var body = new AccountStatusActionDto { OperationId = Guid.NewGuid(), Version = account.Version, Reason = "Isolated HTTP suspension" };
        Assert.Equal(HttpStatusCode.Forbidden, (await nominee.PostAsJsonAsync($"/api/administration/accounts/{member}/suspend", body)).StatusCode);
        operatorClient.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await operatorClient.PostAsJsonAsync($"/api/administration/accounts/{member}/suspend", body)).StatusCode);
        await CsrfAsync(operatorClient);
        Assert.Equal(HttpStatusCode.BadRequest, (await operatorClient.PostAsJsonAsync($"/api/administration/accounts/{member}/suspend", new { operationId = Guid.NewGuid(), version = account.Version })).StatusCode);
        var change = await ReadAsync<AccountStatusChangeDto>(await operatorClient.PostAsJsonAsync($"/api/administration/accounts/{member}/suspend", body));
        Assert.Equal("Suspended", change.Action);
        var history = await ReadAsync<Page<AccountStatusChangeDto>>(await operatorClient.GetAsync($"/api/administration/accounts/{member}/status-history"));
        Assert.Equal(change.Id, Assert.Single(history.Items).Id);
        Assert.Equal(HttpStatusCode.Forbidden, (await nominee.GetAsync($"/api/administration/accounts/{member}/status-history")).StatusCode);
    }

    private static async Task SignInAsync(HttpClient client, string username)
    {
        await CsrfAsync(client);
        var pending = await ReadAsync<JsonElement>(await client.PostAsJsonAsync("/api/auth/login", new { username, password = Password }));
        var challenge = pending.GetProperty("challenge");
        await ReadAsync<JsonElement>(await client.PostAsJsonAsync("/api/auth/login/mfa", new
        {
            accountId = challenge.GetProperty("accountId").GetString(),
            challenge = challenge.GetProperty("challenge").GetString(),
            code = TestAuthenticator.Code()
        }));
        await CsrfAsync(client);
    }

    private static async Task CsrfAsync(HttpClient client)
    {
        var response = await ReadAsync<JsonElement>(await client.GetAsync("/api/auth/csrf"));
        client.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-CSRF-TOKEN", response.GetProperty("token").GetString());
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"{response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        return (await response.Content.ReadFromJsonAsync<T>(Json))!;
    }
}
