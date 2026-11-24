// Purpose: the archdiocese's named billing representative (owner decision, 23 November 2026): its current bishop names the account that acts
// for the archdiocese in billing; until then the registering account acts, as before.
// Main functions: GetAsync (the bishop or the current representative) and SetAsync (bishop only; the account must be active, verified and use
// an authenticator). The payer-transfer approvals read Archdiocese.BillingRepresentative().

using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.Billing;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;

namespace ParishLife.Api.Services.Billing;

public class BillingRepresentativeService(IParishRepository parishes, IArchdioceseAuthority bishops, UserManager<ParishUser> users, ICurrentActor actor,
    TimeProvider clock)
{
    public async Task<BillingRepresentativeDto> GetAsync(string archdiocese, CancellationToken ct)
    {
        var org = await parishes.GetArchdioceseAsync(archdiocese, ct) ?? throw Missing();
        if (org.Value.BillingRepresentative() != actor.AccountId || actor.ActingAppointmentId is not null)
            await bishops.RequireBishopAsync(archdiocese, ct);
        return await ProjectAsync(org);
    }

    public async Task<BillingRepresentativeDto> SetAsync(string archdiocese, SetBillingRepresentativeDto request, CancellationToken ct)
    {
        await bishops.RequireBishopAsync(archdiocese, ct);
        var name = Guard.Text(request.Account, "Account", 254);
        var account = await users.FindByNameAsync(name) ?? await users.FindByEmailAsync(name);
        if (account is not { Active: true, TwoFactorEnabled: true } || !AccountVerification.IsVerified(account))
            throw new DomainException("invalid_input", "Name the username or email of an active, verified account that signs in with an authenticator.");
        var op = actor.CreateOperation(request.OperationId, request, clock, "billing-representative:v1:" + archdiocese);
        await parishes.SetBillingRepresentativeAsync(archdiocese, Versions.Require(request.Version), account.Id, op, ct);
        return await ProjectAsync(await parishes.GetArchdioceseAsync(archdiocese, ct) ?? throw Missing());
    }

    private async Task<BillingRepresentativeDto> ProjectAsync(Versioned<Archdiocese> org)
    {
        var id = org.Value.BillingRepresentative();
        return new BillingRepresentativeDto
        {
            AccountId = id, DisplayName = (await users.FindByIdAsync(id))?.DisplayName ?? string.Empty,
            Named = org.Value.BillingRepresentativeAccountId is not null, Version = org.Version
        };
    }

    private static DomainException Missing() => new("resource_not_found", "The requested resource is unavailable.", FailureKind.NotFound);
}
