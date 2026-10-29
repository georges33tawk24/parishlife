using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;

namespace ParishLive.Infrastructure.Operations;

public sealed record AppointmentInput(string TargetUsername, SystemRole Role, Guid OrgId, Guid ParishId,
    Guid? GroupId, DateTimeOffset StartsAtUtc, DateTimeOffset? EndsAtUtc, string AuthorityReference, Guid OperationId,
    bool MayCreateParishes = false, bool CanReviewSensitiveConcerns = false, bool CanViewConcernIdentity = false);
public sealed record ParishSetupInput(Guid OrgId, string English, string French, string Arabic, string Locality,
    string OfficeContact, string Jurisdiction, string AdoptionReference, string HeadPriestUsername,
    string ExistingAppointmentEvidence, Guid OperationId);

public sealed class AdministrationService(AppDbContext db, ITenantContext tenant, UserManager<ApplicationUser> users)
{
    private string UserId => tenant.UserId ?? throw new ForbiddenException("Error.Unavailable");
    private async Task<Membership> ActorAsync()
    {
        var rows = (await db.Memberships.IgnoreQueryFilters().AsNoTracking().Where(m => m.UserId == UserId).ToListAsync())
            .Where(m => m.IsEffective(DateTimeOffset.UtcNow)).ToList();
        return (tenant.ActingAssignmentId is Guid id ? rows.SingleOrDefault(m => m.Id == id) :
            rows.SingleOrDefault(m => m.Role.ToString() == tenant.ActingRole)) ?? throw new ForbiddenException("Error.Unavailable");
    }
    private static void CanAppoint(Membership actor, SystemRole target, Guid org, Guid parish)
    {
        var permitted = actor.Role switch
        {
            SystemRole.SuperAdmin => target is SystemRole.Archbishop or SystemRole.SuperAdmin,
            SystemRole.Archbishop => actor.OrgId == org && target is SystemRole.Priest or SystemRole.ArchdioceseAdmin or SystemRole.ConcernReviewer,
            SystemRole.Priest => actor.OrgId == org && actor.ParishId == parish && actor.IsHeadPriest &&
                target is SystemRole.Secretary or SystemRole.ParishAdmin or SystemRole.Treasurer or SystemRole.FinanceViewer or SystemRole.MinistryLeader,
            _ => false
        };
        if (!permitted) throw new ForbiddenException("Error.Unavailable");
    }
    private async Task<Guid?> PriorAsync(Guid operation, object payload)
    {
        if (operation == Guid.Empty) throw new DomainException("Error.OperationRequired");
        var record = await db.AdministrativeRecords.IgnoreQueryFilters().SingleOrDefaultAsync(r => r.OperationId == operation && r.ActorUserId == UserId);
        if (record is null) return null;
        if (record.PayloadHash != Hash(payload)) throw new DomainException("Error.OperationMismatch");
        return record.TargetId;
    }
    private static string Hash(object payload) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload))));
    private void Log(Guid operation, string action, Membership actor, Guid parish, string targetUser, Guid target, string reference, object payload, Guid? targetOrg = null)
        => db.AdministrativeRecords.Add(new AdministrativeRecord { OperationId = operation, ActorUserId = UserId,
            Action = action, OrgId = targetOrg ?? actor.OrgId, ParishId = parish, TargetUserId = targetUser, TargetId = target,
            AuthorityReference = Guard.Required(reference, "Authority reference", 500), PayloadHash = Hash(payload) });

    public async Task<Guid> OfferAppointmentAsync(AppointmentInput input)
    {
        var actor = await ActorAsync(); CanAppoint(actor, input.Role, input.OrgId, input.ParishId);
        if (input.Role == SystemRole.SuperAdmin && (input.OrgId != Guid.Empty || input.ParishId != Guid.Empty) ||
            input.Role is SystemRole.Archbishop or SystemRole.ArchdioceseAdmin && input.ParishId != Guid.Empty ||
            input.Role is SystemRole.Priest or SystemRole.Secretary or SystemRole.ParishAdmin or SystemRole.Treasurer or SystemRole.FinanceViewer or SystemRole.MinistryLeader or SystemRole.ConcernReviewer && input.ParishId == Guid.Empty)
            throw new DomainException("Error.Invalid");
        if (input.MayCreateParishes && input.Role != SystemRole.ArchdioceseAdmin ||
            (input.CanReviewSensitiveConcerns || input.CanViewConcernIdentity) && input.Role != SystemRole.ConcernReviewer ||
            input.GroupId is not null && input.Role != SystemRole.MinistryLeader) throw new DomainException("Error.Invalid");
        if (input.EndsAtUtc <= input.StartsAtUtc) throw new DomainException("Error.Invalid");
        var account = await users.FindByNameAsync(input.TargetUsername.Trim()) ?? throw new DomainException("Error.AccountLookup");
        if (account.Id == UserId) throw new DomainException("Error.IndependentReviewer");
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if (await PriorAsync(input.OperationId, input) is Guid prior) return prior;
        if (input.Role is SystemRole.SuperAdmin or SystemRole.Archbishop)
        {
            var privileged = await db.Memberships.IgnoreQueryFilters().Where(m => m.Role == SystemRole.SuperAdmin && m.IsActive).ToListAsync();
            var current = privileged
                .Where(m => m.IsEffective(DateTimeOffset.UtcNow)).ToList();
            if (current.Count >= 2)
            {
                var request = new AdministrativeChangeRequest { SubmittedByUserId = UserId, PayloadJson = JsonSerializer.Serialize(input) };
                db.AdministrativeChanges.Add(request);
                Log(input.OperationId, "ProtectedAppointmentRequested", actor, input.ParishId, account.Id, request.Id, input.AuthorityReference, input, input.OrgId);
                await db.SaveChangesAsync(); await transaction.CommitAsync(); return request.Id;
            }
            if (input.Role != SystemRole.SuperAdmin || current.Count != 1 || privileged.Count != 1)
                throw new DomainException("Error.AdminDualReview");
        }
        else if (!await db.Organizations.AnyAsync(o => o.Id == input.OrgId)) throw new DomainException("Error.Unavailable");
        if (input.ParishId != Guid.Empty && !await db.Parishes.IgnoreQueryFilters().AnyAsync(p => p.Id == input.ParishId && p.OrgId == input.OrgId))
            throw new DomainException("Error.Unavailable");
        if (input.Role == SystemRole.MinistryLeader && !await db.Groups.IgnoreQueryFilters().AnyAsync(g => g.Id == input.GroupId && g.ParishId == input.ParishId))
            throw new DomainException("Error.Unavailable");
        var duplicates = await db.Memberships.IgnoreQueryFilters().Where(m => m.UserId == account.Id && m.Role == input.Role &&
            m.OrgId == input.OrgId && m.ParishId == input.ParishId && m.GroupId == input.GroupId && m.IsActive).ToListAsync();
        var duplicate = duplicates.Any(m => m.Accepted || m.InvitationExpiresAtUtc is null || m.InvitationExpiresAtUtc > DateTimeOffset.UtcNow);
        if (duplicate) throw new DomainException("Error.DuplicatePending");
        var appointment = new Membership { UserId = account.Id, OrgId = input.OrgId, ParishId = input.ParishId, Role = input.Role,
            GroupId = input.GroupId, StartsAtUtc = input.StartsAtUtc, EndsAtUtc = input.EndsAtUtc, Accepted = false,
            AppointedByUserId = UserId, AuthorityReference = Guard.Required(input.AuthorityReference, "Actual authority", 500),
            InvitationExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(7) };
        appointment.MayCreateParishes = input.MayCreateParishes;
        appointment.CanReviewSensitiveConcerns = input.CanReviewSensitiveConcerns;
        appointment.CanViewConcernIdentity = input.CanViewConcernIdentity;
        db.Memberships.Add(appointment);
        Log(input.OperationId, "AppointmentOffered", actor, input.ParishId, account.Id, appointment.Id, input.AuthorityReference, input, input.OrgId);
        await db.SaveChangesAsync(); await transaction.CommitAsync(); return appointment.Id;
    }

    public async Task<Guid> ApproveProtectedAppointmentAsync(Guid requestId, string currentPassword, string authenticatorCode, Guid operationId)
    {
        var actor = await ActorAsync(); if (actor.Role != SystemRole.SuperAdmin) throw new ForbiddenException("Error.Unavailable");
        var account = await users.FindByIdAsync(UserId) ?? throw new ForbiddenException("Error.Unavailable");
        if (!await users.CheckPasswordAsync(account, currentPassword)) throw new ForbiddenException("Error.Reauthentication");
        if (!account.TwoFactorEnabled || !await users.VerifyTwoFactorTokenAsync(account, TokenOptions.DefaultAuthenticatorProvider, authenticatorCode))
            throw new ForbiddenException("Error.MfaRequired");
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if (await PriorAsync(operationId, new { requestId }) is Guid prior) return prior;
        var request = await db.AdministrativeChanges.SingleOrDefaultAsync(c => c.Id == requestId) ?? throw new ForbiddenException("Error.Unavailable");
        if (request.SubmittedByUserId == UserId) throw new DomainException("Error.IndependentReviewer");
        if (request.Status != "Pending") throw new DomainException("Error.State");
        var input = JsonSerializer.Deserialize<AppointmentInput>(request.PayloadJson) ?? throw new DomainException("Error.Invalid");
        CanAppoint(actor, input.Role, input.OrgId, input.ParishId);
        var target = await users.FindByNameAsync(input.TargetUsername) ?? throw new DomainException("Error.AccountLookup");
        if (input.Role == SystemRole.Archbishop && !await db.Organizations.AnyAsync(o => o.Id == input.OrgId)) throw new DomainException("Error.Unavailable");
        var appointment = new Membership { OrgId = input.OrgId, ParishId = input.ParishId, Role = input.Role, UserId = target.Id,
            Accepted = false, StartsAtUtc = input.StartsAtUtc, EndsAtUtc = input.EndsAtUtc, AppointedByUserId = request.SubmittedByUserId,
            AuthorityReference = input.AuthorityReference, InvitationExpiresAtUtc = DateTimeOffset.UtcNow.AddDays(7) };
        db.Memberships.Add(appointment); request.Status = "Approved"; request.ApprovedByUserId = UserId;
        request.AppointmentId = appointment.Id; request.Revision++;
        Log(operationId, "ProtectedAppointmentApproved", actor, input.ParishId, target.Id, appointment.Id, input.AuthorityReference, new { requestId }, input.OrgId);
        await db.SaveChangesAsync(); await transaction.CommitAsync(); return appointment.Id;
    }

    public async Task AcceptAsync(Guid id, bool accept)
    {
        var row = await db.Memberships.IgnoreQueryFilters().SingleOrDefaultAsync(m => m.Id == id && m.UserId == UserId)
            ?? throw new ForbiddenException("Error.Unavailable");
        if (row.Accepted || !row.IsActive || row.EndsAtUtc <= DateTimeOffset.UtcNow || row.InvitationExpiresAtUtc <= DateTimeOffset.UtcNow) throw new DomainException("Error.State");
        row.Accepted = accept; row.IsActive = accept; row.AcceptedAtUtc = accept ? DateTimeOffset.UtcNow : null; row.Revision++;
        db.AdministrativeRecords.Add(new AdministrativeRecord { ActorUserId = UserId, OperationId = Guid.NewGuid(),
            Action = accept ? "AppointmentAccepted" : "AppointmentDeclined", OrgId = row.OrgId, ParishId = row.ParishId,
            TargetUserId = UserId, TargetId = row.Id, AuthorityReference = "Appointee decision", PayloadHash = Hash(new { id, accept }) });
        await db.SaveChangesAsync();
    }

    public async Task RevokeAsync(Guid id, long revision, string reason, Guid operationId)
    {
        var actor = await ActorAsync();
        var target = await db.Memberships.IgnoreQueryFilters().SingleOrDefaultAsync(m => m.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        CanAppoint(actor, target.Role, target.OrgId, target.ParishId);
        if (target.Role == SystemRole.SuperAdmin) throw new DomainException("Error.AdminDualReview");
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if (await PriorAsync(operationId, new { id, revision, reason }) is not null) return;
        if (target.Revision != revision) throw new DomainException("Error.Conflict");
        target.IsActive = false; target.Revision++;
        Log(operationId, "AppointmentRevoked", actor, target.ParishId, target.UserId, target.Id, reason, new { id, revision, reason });
        await db.SaveChangesAsync(); await transaction.CommitAsync();
    }

    public async Task<Guid> CreateOrganizationAsync(string english, string french, string arabic, string authorityReference, Guid operationId)
    {
        var actor = await ActorAsync(); if (actor.Role != SystemRole.SuperAdmin) throw new ForbiddenException("Error.Unavailable");
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var payload = new { english, french, arabic, authorityReference };
        if (await PriorAsync(operationId, payload) is Guid prior) return prior;
        var organization = new Organization { Name = Guard.Required(english, "Approved official organization name", 200),
            NameFrench = Guard.Required(french, "Approved French name", 200), NameArabic = Guard.Required(arabic, "Approved Arabic name", 200) };
        db.Organizations.Add(organization); Log(operationId, "OrganizationCreated", actor, Guid.Empty, "", organization.Id, authorityReference, payload, organization.Id);
        await db.SaveChangesAsync(); await transaction.CommitAsync(); return organization.Id;
    }

    public async Task<Guid> CreateAndActivateParishAsync(ParishSetupInput input)
    {
        var actor = await ActorAsync();
        if (actor.OrgId != input.OrgId || actor.Role != SystemRole.Archbishop && !(actor.Role == SystemRole.ArchdioceseAdmin && actor.MayCreateParishes))
            throw new ForbiddenException("Error.Unavailable");
        var priest = await users.FindByNameAsync(input.HeadPriestUsername) ?? throw new DomainException("Error.AccountLookup");
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if (await PriorAsync(input.OperationId, input) is Guid prior) return prior;
        var parish = new Parish { OrgId = input.OrgId, Name = Guard.Required(input.English, "Approved English name", 200),
            NameFrench = Guard.Required(input.French, "Approved French name", 200), NameArabic = Guard.Required(input.Arabic, "Approved Arabic name", 200),
            Locality = Guard.Required(input.Locality, "Verified locality", 200), OfficeContact = Guard.Required(input.OfficeContact, "Actual office contact", 500),
            Jurisdiction = Guard.Required(input.Jurisdiction, "Approved jurisdiction", 200), AdoptionReference = Guard.Required(input.AdoptionReference, "Actual adoption approval", 500),
            Lifecycle = "Active", PubliclyListed = true };
        db.Parishes.Add(parish);
        db.Memberships.Add(new Membership { OrgId = input.OrgId, ParishId = parish.Id, UserId = priest.Id, Role = SystemRole.Priest,
            IsHeadPriest = true, AppointedByUserId = UserId, StartsAtUtc = DateTimeOffset.UtcNow,
            AuthorityReference = Guard.Required(input.ExistingAppointmentEvidence, "Actual existing priest appointment and consent evidence", 500) });
        Log(input.OperationId, "ParishCreatedAndActivated", actor, parish.Id, priest.Id, parish.Id, input.ExistingAppointmentEvidence, input);
        await db.SaveChangesAsync(); await transaction.CommitAsync(); return parish.Id;
    }

    public async Task ChangeParishStatusAsync(Guid parishId, string lifecycle, string reason, Guid operationId)
    {
        var actor = await ActorAsync();
        var parish = await db.Parishes.IgnoreQueryFilters().SingleOrDefaultAsync(p => p.Id == parishId)
            ?? throw new ForbiddenException("Error.Unavailable");
        if (actor.Role != SystemRole.SuperAdmin && !(actor.Role == SystemRole.Archbishop && actor.OrgId == parish.OrgId))
            throw new ForbiddenException("Error.Unavailable");
        if (lifecycle is not ("Active" or "Suspended" or "Closed")) throw new DomainException("Error.Invalid");
        if (parish.Lifecycle == "Closed" || lifecycle == "Active" && parish.SuspendedByRole == "SuperAdmin" && actor.Role != SystemRole.SuperAdmin)
            throw new DomainException("Error.State");
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var payload = new { parishId, lifecycle, reason };
        if (await PriorAsync(operationId, payload) is not null) return;
        parish.Lifecycle = lifecycle; parish.SuspendedByRole = lifecycle == "Suspended" ? actor.Role.ToString() : null;
        Log(operationId, "ParishStatusChanged", actor, parishId, "", parishId, reason, payload, parish.OrgId);
        await db.SaveChangesAsync(); await transaction.CommitAsync();
    }
}
