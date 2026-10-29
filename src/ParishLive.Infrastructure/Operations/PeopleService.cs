using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Operations;

public sealed record PersonInput(Guid ParishId, Guid? Id, long Revision, string SuppliedName, string? ArabicName,
    string? FrenchName, string? BirthDate, string DatePrecision, string Source, string? DifferentPersonEvidence, Guid OperationId);

public sealed class PeopleService(AppDbContext db, ITenantContext tenant, OperationalAccess access, OperationRunner operations)
{
    public async Task<OperationResult> SaveAsync(PersonInput input)
    {
        await access.OfficeAsync(input.ParishId);
        var name = Guard.Required(input.SuppliedName, "Supplied name", 200);
        if (input.DatePrecision is not ("Exact" or "Year" or "Approximate" or "Unknown")) throw new DomainException("Error.Invalid");
        if (input.DatePrecision == "Unknown" && !string.IsNullOrWhiteSpace(input.BirthDate) ||
            input.DatePrecision == "Year" && !Regex.IsMatch(input.BirthDate ?? "", "^[0-9]{4}$") ||
            input.DatePrecision == "Exact" && (!DateOnly.TryParseExact(input.BirthDate, "yyyy-MM-dd", out var birth) || birth > DateOnly.FromDateTime(DateTime.UtcNow)))
            throw new DomainException("Error.Invalid");
        return await operations.RunAsync(input.ParishId, input.OperationId, "People.Save", input, async () =>
        {
            var candidates = await db.People.AsNoTracking().Where(p => p.ParishId == input.ParishId && p.Id != input.Id).ToListAsync();
            if (input.Id is null && candidates.Any(p => string.Equals(p.SuppliedName, name, StringComparison.OrdinalIgnoreCase)) &&
                string.IsNullOrWhiteSpace(input.DifferentPersonEvidence)) throw new DomainException("Error.DuplicateIdentity");
            var record = input.Id is Guid id ? await db.People.SingleOrDefaultAsync(p => p.Id == id && p.ParishId == input.ParishId)
                ?? throw new ForbiddenException("Error.Unavailable") : new PersonRecord { OrgId = tenant.OrgId, ParishId = input.ParishId };
            if (input.Id is not null) OperationRunner.Expect(record, input.Revision); else db.People.Add(record);
            if (record.Status is "Archived" or "VerifiedDeceased") throw new DomainException("Error.IdentityReview");
            record.SuppliedName = name; record.ArabicName = Guard.Optional(input.ArabicName, "Arabic name", 200);
            record.FrenchName = Guard.Optional(input.FrenchName, "French name", 200); record.BirthDate = input.BirthDate;
            record.DatePrecision = input.DatePrecision; record.Source = Guard.Required(input.Source, "Actual source", 500);
            db.CaseHistories.Add(new CaseHistory { OrgId = record.OrgId, ParishId = record.ParishId, CaseId = record.Id,
                Action = "People.Saved", ActorUserId = access.UserId, InternalNote = input.DifferentPersonEvidence,
                SnapshotJson = System.Text.Json.JsonSerializer.Serialize(record) });
            await db.SaveChangesAsync(); return new(record.Id, record.Revision);
        });
    }

    public async Task<OperationResult> RequestMembershipAsync(Guid parishId, string suppliedName, Guid operationId)
    {
        var parish = await db.Parishes.IgnoreQueryFilters().SingleOrDefaultAsync(p => p.Id == parishId && p.PubliclyListed && p.Lifecycle == "Active")
            ?? throw new ForbiddenException("Error.Unavailable");
        _ = access.UserId;
        return await operations.RunAsync(parishId, operationId, "Membership.Request", new { parishId, suppliedName }, async () =>
        {
            var existing = await db.MembershipReviews.IgnoreQueryFilters().SingleOrDefaultAsync(r => r.ParishId == parishId &&
                r.ApplicantUserId == access.UserId && (r.Status == "Submitted" || r.Status == "NeedsInformation"));
            if (existing is not null) return new(existing.Id, existing.Revision);
            var review = new MembershipReview { OrgId = parish.OrgId, ParishId = parishId, ApplicantUserId = access.UserId,
                SuppliedName = Guard.Required(suppliedName, "Supplied name", 200) };
            db.MembershipReviews.Add(review); await db.SaveChangesAsync(); return new(review.Id, review.Revision);
        });
    }

    public async Task<IReadOnlyList<(Guid Id, string Name, string Status, bool Linked)>> MatchingAsync(Guid reviewId)
    {
        var review = await db.MembershipReviews.SingleOrDefaultAsync(r => r.Id == reviewId) ?? throw new ForbiddenException("Error.Unavailable");
        await access.OfficeAsync(review.ParishId);
        var rows = await db.People.AsNoTracking().Where(p => p.ParishId == review.ParishId).ToListAsync();
        return rows.Where(p => p.SuppliedName.Contains(review.SuppliedName, StringComparison.OrdinalIgnoreCase) ||
            review.SuppliedName.Contains(p.SuppliedName, StringComparison.OrdinalIgnoreCase))
            .Select(p => (p.Id, p.SuppliedName, p.Status, p.LinkedUserId is not null)).ToList();
    }
}
