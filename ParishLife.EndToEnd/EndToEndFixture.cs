// Purpose: prepares the isolated, synthetic fixture the browser tests sign in to: one account per portal role, created through the real
// services (bootstrap, appointments, grants, billing activation, membership, ministry leadership). Test-only setup, never an application seed.
// Main functions: BuildAsync creates accounts, the parish/ministry workflows and an independent parish (no archdiocese) and returns
// the manifest; Code computes the fixture TOTP;
// As/AsAppointment select the principal for each service call.

using System.Buffers.Binary;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Authorization;
using ParishLife.Api.Services.Billing;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;

namespace ParishLife.EndToEnd;

public class EndToEndFixture(IServiceProvider services)
{
    /// <summary>The single fixture password and authenticator key; isolated test values, never production credentials.</summary>
    public const string Password = "isolated-e2e-fixture-password";
    public const string Secret = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    private TimeProvider Clock => services.GetRequiredService<TimeProvider>();
    private DateTimeOffset Now => Clock.GetUtcNow();

    public async Task<Dictionary<string, object>> BuildAsync(CancellationToken ct)
    {
        var accounts = new Dictionary<string, Dictionary<string, object>>();
        var bootstrap = services.GetRequiredService<SuperAdminBootstrapService>();
        var operatorIds = new List<string>();
        foreach (var name in SuperAdminBootstrapService.Usernames)
        {
            var user = await bootstrap.PrepareAsync(name, Password, "isolated end-to-end fixture", ct);
            await bootstrap.CompleteAsync(user, Secret, Code(), ct);
            operatorIds.Add(user.Id);
            accounts[name == "colinsleiman" ? "operator" : "reviewer"] = Entry(name, user.Id, true, "super_admin");
        }
        var (first, second) = (operatorIds[0], operatorIds[1]);
        var bishop = await AccountAsync("bishop", "E2E Bishop", true, accounts);
        var priest = await AccountAsync("priest", "E2E Priest", true, accounts);
        var secretary = await AccountAsync("secretary", "E2E Secretary", true, accounts);
        var treasurer = await AccountAsync("treasurer", "E2E Treasurer", true, accounts);
        var leader = await AccountAsync("leader", "E2E Leader", true, accounts);
        var member = await AccountAsync("member", "E2E Member", false, accounts);
        var visitor = await AccountAsync("visitor", "E2E Visitor", false, accounts);

        var parishes = services.GetRequiredService<ParishService>();
        var repository = services.GetRequiredService<IParishRepository>();

        // A verified archdiocese whose bishop seat is filled through propose, independent review and acceptance.
        As(first);
        var archdiocese = await parishes.RegisterArchdioceseAsync(new RegisterArchdioceseDto { OperationId = Guid.NewGuid(), Name = "E2E Archdiocese", Locality = "E2E locality" }, ct);
        await parishes.VerifyArchdioceseAsync(archdiocese.Id, new VerifyParishDto
        {
            OperationId = Guid.NewGuid(), Version = (await repository.GetArchdioceseAsync(archdiocese.Id, ct))!.Version, EvidenceReference = "isolated e2e verification"
        }, ct);
        var bishops = services.GetRequiredService<BishopAppointmentService>();
        var proposal = await bishops.ProposeAsync(archdiocese.Id, new ProposeBishopAppointmentDto
        {
            OperationId = Guid.NewGuid(), OrganizationVersion = (await repository.GetArchdioceseAsync(archdiocese.Id, ct))!.Version, AccountId = Guid.Parse(bishop),
            StartsAt = Now, EndsAt = Now.AddDays(30), AcceptBy = Now.AddDays(2), ReviewDueAt = Now.AddDays(10),
            EvidenceReference = "isolated e2e appointment evidence", Reason = "Isolated e2e appointment"
        }, ct);
        As(second);
        await bishops.ReviewAsync(archdiocese.Id, proposal.Id, new ReviewBishopAppointmentDto
        {
            OperationId = Guid.NewGuid(), Version = (await bishops.GetAsync(archdiocese.Id, proposal.Id, ct)).Version, Approve = true, Reason = "Isolated e2e review"
        }, ct);
        As(bishop);
        await bishops.DecideAsync(archdiocese.Id, proposal.Id, new DecideBishopInvitationDto
        {
            OperationId = Guid.NewGuid(), Version = (await bishops.GetAsync(archdiocese.Id, proposal.Id, ct)).Version, Accept = true
        }, ct);

        // A verified parish (controlled by the first operator) placed under the archdiocese by the bishop's decision.
        As(first);
        var parish = await parishes.RegisterAsync(new RegisterParishDto { OperationId = Guid.NewGuid(), Name = "E2E Parish", Locality = "E2E locality", Contact = "e2e.example" }, ct);
        await parishes.VerifyAsync(parish.Id, new VerifyParishDto
        {
            OperationId = Guid.NewGuid(), Version = (await repository.GetAsync(parish.Id, ct))!.Version, EvidenceReference = "isolated e2e representative verification"
        }, ct);
        var jurisdiction = services.GetRequiredService<ParishJurisdictionService>();
        var placement = await jurisdiction.ProposeAsync(parish.Id, new ProposeParishJurisdictionDto
        {
            OperationId = Guid.NewGuid(), Version = (await repository.GetAsync(parish.Id, ct))!.Version, ArchdioceseId = Guid.Parse(archdiocese.Id),
            Reason = "Isolated e2e jurisdiction", EvidenceReference = "isolated e2e jurisdiction evidence"
        }, ct);
        As(bishop);
        await jurisdiction.DecideAsync(parish.Id, placement.Id, new DecideParishJurisdictionDto
        {
            OperationId = Guid.NewGuid(), Version = (await jurisdiction.GetAsync(parish.Id, placement.Id, ct)).Version, Accept = true,
            Reason = "Isolated e2e decision", CurrentPassword = Password, CurrentCode = Code()
        }, ct);

        var plan = await PublishPlanAsync(first, ct);
        await ActivateModulesAsync(first, plan, parish.Id, ct);

        // An independent parish: verified and controlled by the first operator, never placed under an archdiocese, with its modules
        // active. Archdiocese-only reads answer 409 or 403 there, and the portal must still open its screens.
        As(first);
        var independent = await parishes.RegisterAsync(new RegisterParishDto
        {
            OperationId = Guid.NewGuid(), Name = "E2E Independent Parish", Locality = "E2E locality", Contact = "e2e-independent.example"
        }, ct);
        await parishes.VerifyAsync(independent.Id, new VerifyParishDto
        {
            OperationId = Guid.NewGuid(), Version = (await repository.GetAsync(independent.Id, ct))!.Version, EvidenceReference = "isolated e2e independent verification"
        }, ct);
        await ActivateModulesAsync(first, plan, independent.Id, ct);

        // The head priest: invited by the bishop with every priest duty, then accepted.
        As(bishop);
        var staff = services.GetRequiredService<StaffAppointmentService>();
        var invitation = await staff.InviteAsync(archdiocese.Id, parish.Id, new InviteStaffAppointmentDto
        {
            OperationId = Guid.NewGuid(), ScopeVersion = (await repository.GetAsync(parish.Id, ct))!.Version, AccountId = Guid.Parse(priest),
            Role = StaffAppointmentRole.Priest, Allows = [.. StaffAppointmentRules.PriestDuties.Order(StringComparer.Ordinal)], Denies = [],
            StartsAt = Now, EndsAt = Now.AddDays(60), AcceptBy = Now.AddDays(1), ReviewDueAt = Now.AddDays(30), IsHead = true,
            Reason = "Isolated e2e priest", EvidenceReference = "isolated e2e priest evidence", CurrentPassword = Password, CurrentCode = Code()
        }, ct);
        As(priest);
        var appointment = await staff.DecideAsync(archdiocese.Id, parish.Id, invitation.Id, new DecideStaffAppointmentDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.GetAsync(archdiocese.Id, parish.Id, invitation.Id, ct)).Version, Accept = true
        }, ct);
        accounts["priest"]["appointmentId"] = appointment.Id;

        // Office grants from the controlling owner: records work makes the secretary's view, finance alone the treasurer's.
        await GrantAsync(first, parish.Id, secretary, [Permissions.PeopleRead, Permissions.PeopleWrite, Permissions.RequestsManage, Permissions.SacramentsRecord,
            Permissions.ScheduleRead, Permissions.RegistrationsManage, Permissions.CommunicationsManage], ct);
        await GrantAsync(first, parish.Id, treasurer, [Permissions.FinanceRead, Permissions.FinanceEnter, Permissions.FinanceApprove, Permissions.FinancePost, Permissions.ReportsRead], ct);

        // Grants and ministry leadership are discovered in parishes the account follows or serves.
        var membership = services.GetRequiredService<MembershipService>();
        foreach (var account in new[] { priest, secretary, treasurer, leader, visitor })
        {
            As(account);
            await membership.FollowAsync(parish.Id, ct);
        }

        // The member applies; the priest (acting in the appointment) creates the person record and links the account.
        As(member, mfa: false);
        var request = await membership.RequestAsync(parish.Id, new RequestMembershipDto { OperationId = Guid.NewGuid(), GivenName = "E2E", FamilyName = "Member" }, ct);
        AsAppointment(priest, appointment.Id);
        var queued = (await membership.QueueAsync(parish.Id, ct)).Single(r => r.Value.Id == request.Id);
        await membership.DecideAsync(parish.Id, request.Id, new MembershipDecisionDto
        {
            OperationId = Guid.NewGuid(), Version = queued.Version, Action = "create-person", EvidenceReference = "isolated e2e identity review"
        }, ct);

        // A synthetic active ministry (fixture record, as in the integration scenarios) with the leader appointed by the priest.
        var ministry = Guid.NewGuid().ToString("N");
        var records = services.GetRequiredService<IRecordTransactions>();
        var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = parish.Id };
        await records.CommitAsync(scope, Operation.Create(Guid.NewGuid(), priest, new { ministry }, Clock), "fixture.ministry", ministry,
            [RecordChange.Create("ministry:" + ministry, "ministry", new Ministry
            {
                Id = ministry, ParishId = parish.Id, Name = "E2E Ministry", Kind = "Ministry", Purpose = "Isolated end-to-end fixture ministry",
                Status = "Active", CreatedBy = priest, CreatedAt = Now
            })], new CommandResult { Id = ministry, Status = "Fixture" }, ct);
        AsAppointment(priest, appointment.Id);
        await ActivatorUtilities.CreateInstance<MinistryLeadershipService>(services).AppointAsync(parish.Id, ministry, new AppointLeaderDto
        {
            OperationId = Guid.NewGuid(), MinistryVersion = (await records.ReadAsync<Ministry>(scope, "ministry:" + ministry, ct))!.Version,
            AccountId = Guid.Parse(leader), Role = "Leader", StartsAt = Now, EndsAt = Now.AddDays(60), EvidenceReference = "isolated e2e leader evidence"
        }, ct);

        services.GetRequiredService<IHttpContextAccessor>().HttpContext = null;
        return new Dictionary<string, object>
        {
            ["password"] = Password,
            ["totpSecret"] = Secret,
            ["archdioceseId"] = archdiocese.Id,
            ["parishId"] = parish.Id,
            ["independentParishId"] = independent.Id,
            ["ministryId"] = ministry,
            ["accounts"] = accounts
        };
    }

    private async Task<string> AccountAsync(string role, string displayName, bool mfa, Dictionary<string, Dictionary<string, object>> accounts)
    {
        var name = role + "@e2e.example";
        var users = services.GetRequiredService<UserManager<ParishUser>>();
        var user = new ParishUser { Id = Guid.NewGuid().ToString("N"), UserName = name, Email = name, DisplayName = displayName };
        Require((await users.CreateAsync(user, Password)).Succeeded, "create " + name);
        // Identity review and authenticator enrollment are controlled fixture setup, never application seeds.
        user.IdentityVerified = true;
        user.ContactVerificationReference = "isolated e2e account verification";
        if (mfa)
            await ((IUserAuthenticatorKeyStore<ParishUser>)services.GetRequiredService<IUserStore<ParishUser>>()).SetAuthenticatorKeyAsync(user, Secret, default);
        user.TwoFactorEnabled = mfa;
        Require((await users.UpdateAsync(user)).Succeeded, "verify " + name);
        accounts[role] = Entry(name, user.Id, mfa, role);
        return user.Id;
    }

    private static Dictionary<string, object> Entry(string username, string id, bool mfa, string role)
        => new() { ["username"] = username, ["id"] = id, ["mfa"] = mfa, ["role"] = role };

    private async Task GrantAsync(string owner, string parish, string account, string[] allows, CancellationToken ct)
    {
        As(owner);
        await services.GetRequiredService<ParishService>().GrantAsync(parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await services.GetRequiredService<IParishRepository>().GetAsync(parish, ct))!.Version,
            AccountId = Guid.Parse(account), Allows = allows, Denies = [], StartsAt = Now
        }, ct);
    }

    private async Task<string> PublishPlanAsync(string operatorId, CancellationToken ct)
    {
        As(operatorId);
        var plan = await services.GetRequiredService<BillingService>().PublishPlanAsync(new PublishPlanDto
        {
            OperationId = Guid.NewGuid(), Name = "E2E plan", Amount = 1, Currency = "USD", MinorUnits = 2, TermMonths = 1,
            Modules = ["core", "office", "facilities", "finance", "ministries", "requests", "sacraments"]
        }, ct);
        return plan.Id;
    }

    private async Task ActivateModulesAsync(string operatorId, string planId, string parish, CancellationToken ct)
    {
        As(operatorId);
        var billing = services.GetRequiredService<BillingService>();
        var invoice = await billing.CreateInvoiceAsync(parish, new CreateInvoiceDto { OperationId = Guid.NewGuid(), PlanId = Guid.Parse(planId), StartsAt = Now }, ct);
        var row = await billing.GetAsync(parish, invoice.Id, ct);
        await billing.RecordCashAsync(parish, invoice.Id, new RecordCashDto
        {
            OperationId = Guid.NewGuid(), Version = row.Invoice.Version, Amount = 1, Currency = "USD", ReceivedAt = Now,
            PayerName = "E2E payer", CollectedBy = "E2E collector", ReceiptReference = "isolated e2e payment proof"
        }, ct);
        Require(await services.GetRequiredService<CoverageActivationProcessor>().ProcessAsync("isolated-e2e", ct) == 1, "module activation");
    }

    private void As(string accountId, bool mfa = true)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, accountId) };
        if (mfa)
            claims.Add(new Claim("amr", "mfa"));
        services.GetRequiredService<IHttpContextAccessor>().HttpContext = new DefaultHttpContext
        {
            RequestServices = services,
            User = new ClaimsPrincipal(new ClaimsIdentity(claims, "IsolatedE2EFixture"))
        };
    }

    private void AsAppointment(string accountId, string appointmentId)
    {
        As(accountId);
        services.GetRequiredService<IHttpContextAccessor>().HttpContext!.Request.Headers["X-ParishLife-Appointment"] = appointmentId;
    }

    private static void Require(bool condition, string step)
    {
        if (!condition)
            throw new InvalidOperationException("End-to-end fixture step failed: " + step);
    }

    /// <summary>The current TOTP for the all-zero fixture key (Base32 "AAAA…"), matching ASP.NET Core Identity's authenticator provider.</summary>
    public static string Code()
    {
        Span<byte> counter = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(counter, DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30);
        var hash = HMACSHA1.HashData(new byte[20], counter);
        var offset = hash[^1] & 15;
        var value = BinaryPrimitives.ReadInt32BigEndian(hash.AsSpan(offset, 4)) & int.MaxValue;
        return (value % 1_000_000).ToString("D6", System.Globalization.CultureInfo.InvariantCulture);
    }
}
