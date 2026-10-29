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

public sealed class CommunityService(AppDbContext db, ITenantContext tenant, OperationalAccess access, OperationRunner operations)
{
    public async Task<OperationResult> ApplyAsync(Guid groupId, bool departure, string? reason, Guid operationId)
    {
        var group = await db.Groups.SingleOrDefaultAsync(g => g.Id == groupId && g.IsActive) ?? throw new ForbiddenException("Error.Unavailable");
        await access.RequireAsync(group.ParishId, SystemRole.Member, SystemRole.Priest, SystemRole.Secretary, SystemRole.MinistryLeader);
        return await operations.RunAsync(group.ParishId, operationId, "Ministry.Apply", new { groupId, departure, reason }, async () =>
        {
            if (!await db.People.AnyAsync(p => p.ParishId == group.ParishId && p.LinkedUserId == access.UserId && p.Status == "Active"))
                throw new DomainException("Error.PersonLink");
            var active = await db.GroupMembers.AnyAsync(m => m.GroupId == groupId && m.UserId == access.UserId && m.EndDate == null);
            if (departure != active) throw new DomainException("Error.State");
            if (await db.MinistryApplications.AnyAsync(a => a.GroupId == groupId && a.ApplicantUserId == access.UserId &&
                a.IsDeparture == departure && (a.Status == "Submitted" || a.Status == "LeaderApproved" || a.Status == "WithdrawalRequested")))
                throw new DomainException("Error.DuplicatePending");
            var application = new MinistryApplication { OrgId = group.OrgId, ParishId = group.ParishId, GroupId = groupId,
                ApplicantUserId = access.UserId, IsDeparture = departure, PrivateReason = departure ? Guard.Optional(reason, "Reason", 2000) : null };
            db.MinistryApplications.Add(application); await db.SaveChangesAsync(); return new(application.Id, application.Revision);
        });
    }

    public async Task<OperationResult> ReviewAsync(Guid id, long revision, string action, Guid operationId)
    {
        var application = await db.MinistryApplications.SingleOrDefaultAsync(a => a.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        if (action == "Withdraw")
        {
            if (application.ApplicantUserId != access.UserId || application.IsDeparture) throw new ForbiddenException("Error.Unavailable");
        }
        else await access.RequireGroupAsync(application.ParishId, application.GroupId, application.IsDeparture || action != "Recommend");
        return await operations.RunAsync(application.ParishId, operationId, "Ministry." + action, new { id, revision, action }, async () =>
        {
            OperationRunner.Expect(application, revision);
            if (application.Status is not ("Submitted" or "LeaderApproved" or "WithdrawalRequested")) throw new DomainException("Error.State");
            if (action == "Withdraw") application.Status = application.Status == "Submitted" ? "Withdrawn" : "WithdrawalRequested";
            else if (action == "Recommend" && !application.IsDeparture && application.Status == "Submitted") application.Status = "LeaderApproved";
            else if (action == "ApproveWithdrawal" && application.Status == "WithdrawalRequested") application.Status = "Withdrawn";
            else if (action == "Approve" && application.Status != "WithdrawalRequested")
            {
                var existing = await db.GroupMembers.Where(m => m.GroupId == application.GroupId &&
                    m.UserId == application.ApplicantUserId && m.EndDate == null).ToListAsync();
                if (application.IsDeparture)
                {
                    foreach (var member in existing) member.EndDate = DateOnly.FromDateTime(DateTime.UtcNow);
                }
                else if (existing.Count == 0)
                    db.GroupMembers.Add(new GroupMember { OrgId = application.OrgId, ParishId = application.ParishId,
                        GroupId = application.GroupId, UserId = application.ApplicantUserId, Role = CommitteeRole.RegularMember,
                        StartDate = DateOnly.FromDateTime(DateTime.UtcNow) });
                application.Status = "Approved";
            }
            else throw new DomainException("Error.State");
            // Departure notes stay in the dedicated record; the operational history carries no private reason.
            db.CaseHistories.Add(new CaseHistory { OrgId = application.OrgId, ParishId = application.ParishId, CaseId = id,
                Action = "Ministry." + action, ActorUserId = access.UserId, ToState = application.Status });
            await db.SaveChangesAsync(); return new(application.Id, application.Revision);
        });
    }

    public async Task<OperationResult> ReviewMembershipAsync(Guid id, long revision, Guid? personId, string method, string message, Guid operationId)
    {
        var review = await db.MembershipReviews.SingleOrDefaultAsync(r => r.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await access.OfficeAsync(review.ParishId);
        return await operations.RunAsync(review.ParishId, operationId, "Membership.Review", new { id, revision, personId, method, message }, async () =>
        {
            OperationRunner.Expect(review, revision);
            if (review.ApplicantUserId == access.UserId) throw new DomainException("Error.IndependentReviewer");
            if (review.Status is not ("Submitted" or "NeedsInformation")) throw new DomainException("Error.State");
            if (personId is null)
            {
                review.Status = "NeedsInformation"; review.ApplicantMessage = Guard.Required(message, "Message", 2000);
            }
            else
            {
                var person = await db.People.SingleOrDefaultAsync(p => p.Id == personId && p.ParishId == review.ParishId)
                    ?? throw new DomainException("Error.Unavailable");
                if (person.LinkedUserId is not null && person.LinkedUserId != review.ApplicantUserId)
                    throw new DomainException("Error.PersonAlreadyLinked");
                if (person.Status is "Archived" or "VerifiedDeceased") throw new DomainException("Error.IdentityReview");
                review.VerificationReference = Guard.Required(method, "Actual identity review method and evidence", 500);
                review.PersonId = person.Id; review.Status = "Approved"; review.ReviewerUserId = access.UserId;
                person.LinkedUserId = review.ApplicantUserId; person.Status = "Active";
                if (!await db.Memberships.IgnoreQueryFilters().AnyAsync(m => m.UserId == review.ApplicantUserId &&
                    m.ParishId == review.ParishId && m.Role == SystemRole.Member && m.IsActive))
                    db.Memberships.Add(new Membership { OrgId = review.OrgId, ParishId = review.ParishId,
                        UserId = review.ApplicantUserId, Role = SystemRole.Member });
            }
            await db.SaveChangesAsync(); return new(review.Id, review.Revision);
        });
    }

    public async Task<OperationResult> SaveContentAsync(Guid parish, Guid? id, long revision, string slug,
        IReadOnlyDictionary<string, string> translations, Guid operationId)
    {
        await access.OfficeAsync(parish);
        if (translations.Keys.Any(k => k is not ("en" or "fr" or "ar")) || translations.Values.Any(v => v.Length > 10000))
            throw new DomainException("Error.Invalid");
        return await operations.RunAsync(parish, operationId, "Content.SaveDraft", new { parish, id, revision, slug, translations }, async () =>
        {
            var content = id is Guid key ? await db.ContentPages.SingleOrDefaultAsync(c => c.Id == key && c.ParishId == parish)
                ?? throw new ForbiddenException("Error.Unavailable") : new ContentPage { OrgId = tenant.OrgId, ParishId = parish, Slug = Guard.Required(slug, "Slug", 100) };
            if (id is not null) OperationRunner.Expect(content, revision); else db.ContentPages.Add(content);
            content.DraftJson = JsonSerializer.Serialize(translations); content.EditorUserId = access.UserId;
            await db.SaveChangesAsync(); return new(content.Id, content.Revision);
        });
    }

    public async Task<OperationResult> PublishContentAsync(Guid id, long revision, Guid operationId)
    {
        var content = await db.ContentPages.SingleOrDefaultAsync(c => c.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await access.RequireAsync(content.ParishId, SystemRole.Priest);
        return await operations.RunAsync(content.ParishId, operationId, "Content.Publish", new { id, revision }, async () =>
        {
            OperationRunner.Expect(content, revision);
            var values = JsonSerializer.Deserialize<Dictionary<string, string>>(content.DraftJson) ?? [];
            if (new[] { "en", "fr", "ar" }.Any(k => !values.TryGetValue(k, out var value) || string.IsNullOrWhiteSpace(value)))
                throw new DomainException("Error.Translations");
            db.CaseHistories.Add(new CaseHistory { OrgId = content.OrgId, ParishId = content.ParishId, CaseId = id,
                Action = "Content.Publish", ActorUserId = access.UserId, SnapshotJson = content.DraftJson });
            content.PublishedJson = content.DraftJson; content.PublisherUserId = access.UserId; content.PublishedRevision = revision + 1;
            await db.SaveChangesAsync(); return new(content.Id, content.Revision);
        });
    }
}
