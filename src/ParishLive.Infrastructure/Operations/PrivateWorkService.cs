using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Operations;

public sealed record PrivateNoteView(Guid Id, string Title, string Body, string Audience, string Status, long Revision);
public sealed record ConcernView(Guid Id, string Narrative, string Status, string? SubmitterUserId, long Revision);
public sealed record ConcernMessage(string Action, string? Reply, string? ReviewerNote, DateTimeOffset At);

public sealed class PrivateWorkService(AppDbContext db, ITenantContext tenant, OperationalAccess access, OperationRunner operations)
{
    public async Task<OperationResult> SaveNoteAsync(Guid parish, Guid? id, long revision, string title, string body,
        string audience, string? assignee, bool shareConfirmed, Guid operationId)
    {
        await access.RequireAsync(parish, SystemRole.Priest, SystemRole.Member);
        if (audience is not ("Author" or "NamedPriest" or "CurrentPriests")) throw new DomainException("Error.Invalid");
        if (audience != "Author")
        {
            await access.RequireAsync(parish, SystemRole.Priest);
            if (!shareConfirmed) throw new DomainException("Error.ShareConfirmation");
            if (audience == "NamedPriest")
            {
                var candidates = await db.Memberships.IgnoreQueryFilters().Where(m => m.ParishId == parish &&
                    m.UserId == assignee && m.Role == SystemRole.Priest).ToListAsync();
                if (!candidates.Any(m => m.IsEffective(DateTimeOffset.UtcNow))) throw new DomainException("Error.PriestAssignment");
            }
        }
        return await operations.RunAsync(parish, operationId, "Notes.Save", new { parish, id, revision, title, body, audience, assignee }, async () =>
        {
            var note = id is Guid key ? await db.PrivateNotebooks.SingleOrDefaultAsync(n => n.Id == key && n.AuthorUserId == access.UserId)
                ?? throw new ForbiddenException("Error.Unavailable") : new PrivateNotebook { OrgId = tenant.OrgId, ParishId = parish, AuthorUserId = access.UserId };
            if (id is null) db.PrivateNotebooks.Add(note); else OperationRunner.Expect(note, revision);
            note.Title = Guard.Required(title, "Title", 200); note.Body = Guard.Required(body, "Body", 10000);
            note.Audience = audience; note.AssigneeUserId = audience == "NamedPriest" ? assignee : null;
            await db.SaveChangesAsync(); return new(note.Id, note.Revision);
        });
    }

    public async Task<IReadOnlyList<PrivateNoteView>> NotesAsync() => await db.PrivateNotebooks.AsNoTracking()
        .Select(n => new PrivateNoteView(n.Id, n.Title, n.Body, n.Audience, n.Status, n.Revision)).ToListAsync();

    public async Task<OperationResult> SubmitConcernAsync(Guid parish, string narrative, bool anonymous, bool sensitive,
        string[] reviewerIds, Guid operationId)
    {
        await access.RequireAsync(parish, SystemRole.Member, SystemRole.Priest, SystemRole.Secretary,
            SystemRole.ParishAdmin, SystemRole.Treasurer, SystemRole.MinistryLeader);
        var candidates = await db.Memberships.IgnoreQueryFilters().AsNoTracking().Where(m => m.ParishId == parish &&
            m.Role == SystemRole.ConcernReviewer && reviewerIds.Contains(m.UserId)).ToListAsync();
        var eligible = candidates.Where(m => m.IsEffective(DateTimeOffset.UtcNow) && m.UserId != access.UserId &&
            (!sensitive || m.CanReviewSensitiveConcerns)).Select(m => m.UserId).Distinct().ToList();
        if (eligible.Count != reviewerIds.Distinct().Count() || eligible.Count == 0) throw new DomainException("Error.IndependentRoute");
        return await operations.RunAsync(parish, operationId, "Concern.Submit", new { parish, narrative, anonymous, sensitive, reviewerIds }, async () =>
        {
            var concern = new ConcernRecord { OrgId = tenant.OrgId, ParishId = parish, SubmitterUserId = access.UserId,
                Narrative = Guard.Required(narrative, "Narrative", 10000), AnonymousToReviewers = anonymous, Sensitive = sensitive };
            db.Concerns.Add(concern);
            foreach (var reviewer in eligible)
            {
                db.ConcernAccess.Add(new ConcernAccess { OrgId = tenant.OrgId, ParishId = parish, ConcernId = concern.Id,
                    ReviewerUserId = reviewer, CanViewSensitive = sensitive && candidates.Any(m => m.UserId == reviewer && m.CanReviewSensitiveConcerns),
                    CanViewIdentity = !anonymous && candidates.Any(m => m.UserId == reviewer && m.CanViewConcernIdentity) });
                db.AccountNotifications.Add(new AccountNotification { RecipientUserId = reviewer, ParishId = parish,
                    RecordId = concern.Id, OperationId = operationId, MessageCode = "M05" });
            }
            // No general audit, home activity, global search, or office notification is emitted.
            await db.SaveChangesAsync(); return new(concern.Id, concern.Revision);
        });
    }

    public async Task<IReadOnlyList<ConcernView>> ConcernsAsync()
    {
        var rows = await db.Concerns.AsNoTracking().ToListAsync();
        var result = new List<ConcernView>();
        foreach (var row in rows)
        {
            var own = row.SubmitterUserId == access.UserId;
            var grant = await db.ConcernAccess.AsNoTracking().SingleOrDefaultAsync(a => a.ConcernId == row.Id && a.ReviewerUserId == access.UserId);
            if (!own && grant is null) continue;
            result.Add(new(row.Id, row.Narrative, row.Status,
                own || !row.AnonymousToReviewers && grant?.CanViewIdentity == true ? row.SubmitterUserId : null, row.Revision));
        }
        return result;
    }

    public async Task<IReadOnlyList<ConcernMessage>> ConcernMessagesAsync(Guid id)
    {
        var concern = await db.Concerns.AsNoTracking().SingleOrDefaultAsync(c => c.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        var reviewer = await db.ConcernAccess.AnyAsync(a => a.ConcernId == id);
        var rows = await db.ConcernLogs.AsNoTracking().Where(l => l.ConcernId == id).ToListAsync();
        return rows.OrderBy(l => l.CreatedAt).Select(l => new ConcernMessage(l.Action, l.ApplicantReply,
            reviewer ? l.ReviewerNote : null, l.CreatedAt)).ToList();
    }

    public async Task ReviewConcernAsync(Guid id, long revision, string action, string? applicantReply, string? reviewerNote, Guid operationId)
    {
        var concern = await db.Concerns.SingleOrDefaultAsync(c => c.Id == id) ?? throw new ForbiddenException("Error.Unavailable");
        await access.RequireAsync(concern.ParishId, SystemRole.ConcernReviewer);
        var grant = await db.ConcernAccess.SingleOrDefaultAsync(a => a.ConcernId == id && a.ReviewerUserId == access.UserId)
            ?? throw new ForbiddenException("Error.Unavailable");
        await operations.RunAsync(concern.ParishId, operationId, "Concern." + action, new { id, revision, action, applicantReply, reviewerNote }, async () =>
        {
            OperationRunner.Expect(concern, revision);
            if (action == "Recuse") { grant.Conflicted = true; Guard.Required(reviewerNote, "Conflict basis", 2000); }
            else if (action == "Start" && concern.Status == "Submitted") concern.Status = "InReview";
            else if (action == "Reply" && concern.Status != "Closed") Guard.Required(applicantReply, "Applicant-safe reply", 2000);
            else if (action == "Close" && concern.Status == "InReview") { Guard.Required(applicantReply, "Closure explanation", 2000); concern.Status = "Closed"; }
            else if (action == "Reopen" && concern.Status == "Closed") { Guard.Required(reviewerNote, "Reopen basis", 2000); concern.Status = "InReview"; }
            else throw new DomainException("Error.State");
            db.ConcernLogs.Add(new ConcernLog { OrgId = concern.OrgId, ParishId = concern.ParishId, ConcernId = id,
                ActorUserId = access.UserId, Action = action, ApplicantReply = Guard.Optional(applicantReply, "Reply", 2000),
                ReviewerNote = Guard.Optional(reviewerNote, "Restricted reviewer note", 2000) });
            concern.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(); return new(concern.Id, concern.Revision);
        });
    }
}
