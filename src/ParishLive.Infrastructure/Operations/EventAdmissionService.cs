using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Operations;

public sealed class EventAdmissionService(AppDbContext db, ITenantContext tenant, OperationalAccess access, OperationRunner operations)
{
    public async Task<bool> CanOperateAsync(Guid eventId)
    {
        var occurrence = await db.Events.AsNoTracking().SingleOrDefaultAsync(e => e.Id == eventId);
        if (occurrence is null || occurrence.IsMass) return false;
        try { await OperatorAsync(new EventAdmission { OrgId = occurrence.OrgId, ParishId = occurrence.ParishId, EventId = eventId }); return true; }
        catch (ForbiddenException) { return false; }
    }
    public async Task<OperationResult> ReserveAsync(Guid eventId, string participantId, DateOnly? birthDate, Guid operationId)
    {
        var occurrence = await db.Events.SingleOrDefaultAsync(e => e.Id == eventId) ?? throw new ForbiddenException("Error.Unavailable");
        await access.RequireAsync(occurrence.ParishId, SystemRole.Member, SystemRole.Priest, SystemRole.Secretary,
            SystemRole.ParishAdmin, SystemRole.MinistryLeader);
        var staff = tenant.ActingRole is "Priest" or "Secretary" or "ParishAdmin";
        if (!staff && (occurrence.Visibility == EventVisibility.SpecificGroups &&
                !await db.GroupMembers.AnyAsync(m => m.GroupId == occurrence.GroupId && m.UserId == access.UserId && m.EndDate == null) ||
            occurrence.Visibility == EventVisibility.Roles || occurrence.Visibility == EventVisibility.Invited &&
                !await db.EventRegistrations.AnyAsync(r => r.EventId == eventId && r.UserId == access.UserId)))
            throw new ForbiddenException("Error.Unavailable");
        if (participantId != access.UserId)
        {
            var subject = await db.People.SingleOrDefaultAsync(p => p.Id.ToString() == participantId);
            var grants = subject is null ? [] : await db.RepresentationGrants.Where(g => g.SubjectPersonId == subject.Id &&
                g.RepresentativeUserId == access.UserId && !g.Revoked && g.Purpose == "Event").ToListAsync();
            if (subject is null || subject.Status is "Archived" or "VerifiedDeceased" ||
                !grants.Any(g => g.ExpiresAtUtc is null || g.ExpiresAtUtc > DateTimeOffset.UtcNow))
                throw new ForbiddenException("Error.Representation");
        }
        var participantName = participantId == access.UserId
            ? await db.Users.Where(u => u.Id == participantId).Select(u => u.DisplayName).SingleOrDefaultAsync()
            : await db.People.Where(p => p.Id.ToString() == participantId).Select(p => p.SuppliedName).SingleOrDefaultAsync();
        return await operations.RunAsync(occurrence.ParishId, operationId, "Event.Reserve", new { eventId, participantId, birthDate }, async () =>
        {
            await db.Entry(occurrence).ReloadAsync();
            if (occurrence.IsMass || !occurrence.RegistrationOpen || occurrence.EndUtc <= DateTimeOffset.UtcNow)
                throw new DomainException("Error.State");
            var existing = await db.EventAdmissions.SingleOrDefaultAsync(a => a.EventId == eventId && a.ParticipantUserId == participantId);
            if (existing is not null) return new(existing.Id, existing.Revision);
            var admissions = await db.EventAdmissions.Where(a => a.EventId == eventId).ToListAsync();
            var legacy = await db.EventRegistrations.Where(r => r.EventId == eventId).Select(r => r.UserId).ToListAsync();
            var occupied = admissions.Where(a => a.Place is PlaceStatus.Reserved or PlaceStatus.Confirmed or PlaceStatus.NeedsReconfirmation)
                .Select(a => a.ParticipantUserId).Concat(legacy.Where(u => admissions.All(a => a.ParticipantUserId != u))).Distinct().Count();
            var record = new EventAdmission { OrgId = occurrence.OrgId, ParishId = occurrence.ParishId, EventId = eventId,
                RequesterUserId = access.UserId, ParticipantUserId = participantId, ParticipantName = participantName ?? "", BirthDate = birthDate,
                Place = occurrence.Capacity is int capacity && occupied >= capacity ? PlaceStatus.Waitlisted : PlaceStatus.Reserved };
            db.EventAdmissions.Add(record); occurrence.Revision++;
            await db.SaveChangesAsync(); return new(record.Id, record.Revision);
        });
    }

    private async Task<Event> OperatorAsync(EventAdmission admission)
    {
        var occurrence = await db.Events.SingleAsync(e => e.Id == admission.EventId);
        if (occurrence.IsMass) throw new ForbiddenException("Error.Unavailable");
        var assignment = await access.RequireAsync(admission.ParishId, SystemRole.Priest, SystemRole.Secretary,
            SystemRole.ParishAdmin, SystemRole.MinistryLeader);
        if (assignment.Role == SystemRole.MinistryLeader && assignment.GroupId != occurrence.GroupId)
            throw new ForbiddenException("Error.Unavailable");
        var policy = await db.ParishPolicies.SingleOrDefaultAsync(p => p.ParishId == admission.ParishId);
        if (policy?.SafeguardingPolicyApproved != true || policy.SafeguardingLeadUserId != access.UserId)
            throw new ForbiddenException("Error.SafeguardingPolicy");
        return occurrence;
    }

    public async Task<OperationResult> VerifyConsentAsync(Guid id, long revision, string evidenceReference,
        string[] collectors, bool independentExit, Guid operationId, DateOnly? verifiedBirthDate = null)
    {
        var record = await db.EventAdmissions.SingleOrDefaultAsync(a => a.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        var occurrence = await OperatorAsync(record);
        return await operations.RunAsync(record.ParishId, operationId, "Event.Consent", new { id, revision, evidenceReference, collectors, independentExit, verifiedBirthDate }, async () =>
        {
            OperationRunner.Expect(record, revision);
            var policy = await db.ParishPolicies.SingleOrDefaultAsync(p => p.ParishId == record.ParishId);
            if (policy?.SafeguardingPolicyApproved != true || policy.SafeguardingLeadUserId is null)
                throw new DomainException("Error.SafeguardingPolicy");
            if (verifiedBirthDate is not null) record.BirthDate = verifiedBirthDate;
            if (record.BirthDate is null || record.BirthDate > DateOnly.FromDateTime(occurrence.StartUtc.UtcDateTime))
                throw new DomainException("Error.AgeReview");
            record.ConsentEvidenceReference = Guard.Required(evidenceReference, "Actual reviewed consent and authority", 500);
            record.ConsentVerified = true; record.ConsentVersion = occurrence.ConsentVersion;
            record.ApprovedCollectorsJson = JsonSerializer.Serialize(collectors.Select(c => Guard.Required(c, "Collector identity", 200)).Distinct());
            record.IndependentExitApproved = independentExit;
            await db.SaveChangesAsync(); return new(record.Id, record.Revision);
        });
    }

    public async Task<OperationResult> ConfirmAsync(Guid id, long revision, Guid operationId)
    {
        var record = await db.EventAdmissions.SingleOrDefaultAsync(a => a.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        var occurrence = await OperatorAsync(record);
        return await operations.RunAsync(record.ParishId, operationId, "Event.Confirm", new { id, revision }, async () =>
        {
            OperationRunner.Expect(record, revision);
            if (record.Place is not (PlaceStatus.Reserved or PlaceStatus.NeedsReconfirmation) || !record.ConsentVerified ||
                record.BirthDate is null || record.ConsentVersion != occurrence.ConsentVersion) throw new DomainException("Error.Consent");
            record.Place = PlaceStatus.Confirmed; occurrence.Revision++;
            await db.SaveChangesAsync(); return new(record.Id, record.Revision);
        });
    }

    public async Task<OperationResult> ArrivalAsync(Guid id, long revision, DateTimeOffset actualAt, Guid operationId,
        bool reconcilePaper = false, string? evidenceReference = null)
    {
        var record = await db.EventAdmissions.SingleOrDefaultAsync(a => a.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        var occurrence = await OperatorAsync(record);
        return await operations.RunAsync(record.ParishId, operationId, "Event.Arrival", new { id, revision, actualAt, reconcilePaper, evidenceReference }, async () =>
        {
            OperationRunner.Expect(record, revision);
            var policy = await db.ParishPolicies.SingleOrDefaultAsync(p => p.ParishId == record.ParishId);
            if (policy?.SafeguardingPolicyApproved != true || policy.SafeguardingLeadUserId is null)
                throw new DomainException("Error.SafeguardingPolicy");
            if (record.Place != PlaceStatus.Confirmed || !record.ConsentVerified || record.ConsentVersion != occurrence.ConsentVersion)
                throw new DomainException("Error.Consent");
            if (actualAt > DateTimeOffset.UtcNow || actualAt < occurrence.StartUtc.AddDays(-1) || actualAt > occurrence.EndUtc.AddDays(1))
                throw new DomainException("Error.Invalid");
            if (record.ArrivedAtUtc is not null && record.ExitedAtUtc is null) throw new DomainException("Error.AlreadyPresent");
            if (reconcilePaper) Guard.Required(evidenceReference, "Reviewed paper log reference", 500);
            record.ArrivedAtUtc = actualAt; record.ExitedAtUtc = null;
            db.AttendanceMovements.Add(new AttendanceMovement { OrgId = record.OrgId, ParishId = record.ParishId,
                AdmissionId = id, EventId = record.EventId, Action = "Arrival", ActorUserId = access.UserId, ActualAtUtc = actualAt,
                PaperReconciled = reconcilePaper, EvidenceReference = evidenceReference });
            await db.SaveChangesAsync(); return new(record.Id, record.Revision);
        });
    }

    public async Task<OperationResult> PickupAsync(Guid id, long revision, string collectorIdentity,
        string identityCheckReference, bool independentExit, Guid operationId, DateTimeOffset? actualAtUtc = null,
        bool reconcilePaper = false, string? paperReference = null)
    {
        var record = await db.EventAdmissions.SingleOrDefaultAsync(a => a.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await OperatorAsync(record);
        return await operations.RunAsync(record.ParishId, operationId, "Event.Pickup",
            new { id, revision, collectorIdentity, identityCheckReference, independentExit, actualAtUtc, reconcilePaper, paperReference }, async () =>
        {
            OperationRunner.Expect(record, revision);
            if (record.ArrivedAtUtc is null || record.ExitedAtUtc is not null) throw new DomainException("Error.State");
            var collectors = JsonSerializer.Deserialize<string[]>(record.ApprovedCollectorsJson ?? "[]") ?? [];
            if (independentExit ? !record.IndependentExitApproved : !collectors.Contains(collectorIdentity, StringComparer.Ordinal))
                throw new DomainException("Error.UnauthorizedCollector");
            Guard.Required(identityCheckReference, "Actual identity check", 500);
            if (reconcilePaper) Guard.Required(paperReference, "Actual paper pickup log", 500);
            if (actualAtUtc is not null && !reconcilePaper) throw new DomainException("Error.Invalid");
            var exitedAt = actualAtUtc ?? DateTimeOffset.UtcNow;
            if (exitedAt < record.ArrivedAtUtc || exitedAt > DateTimeOffset.UtcNow) throw new DomainException("Error.Invalid");
            record.ExitedAtUtc = exitedAt;
            db.AttendanceMovements.Add(new AttendanceMovement { OrgId = record.OrgId, ParishId = record.ParishId,
                AdmissionId = id, EventId = record.EventId, Action = independentExit ? "IndependentExit" : "Pickup",
                ActorUserId = access.UserId, ActualAtUtc = record.ExitedAtUtc.Value,
                EvidenceReference = reconcilePaper ? identityCheckReference + " / " + paperReference : identityCheckReference, PaperReconciled = reconcilePaper });
            await db.SaveChangesAsync(); return new(record.Id, record.Revision);
        });
    }
}
