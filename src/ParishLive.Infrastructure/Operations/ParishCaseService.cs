using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Application.Operations;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Operations;

public sealed class ParishCaseService(AppDbContext db, ITenantContext tenant, OperationalAccess access, OperationRunner operations)
{
    private static readonly HashSet<ServiceKind> Religious = [ServiceKind.Baptism, ServiceKind.Communion,
        ServiceKind.Confirmation, ServiceKind.Marriage];

    public async Task<OperationResult> CreateAsync(NewCase input)
    {
        var parish = await db.Parishes.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(p => p.Id == input.ParishId)
            ?? throw new ForbiddenException("Error.Unavailable");
        if (parish.Lifecycle != "Active") throw new DomainException("Error.Unavailable");
        try { await access.RequireAsync(input.ParishId, SystemRole.Priest, SystemRole.Secretary,
            SystemRole.ParishAdmin, SystemRole.Member, SystemRole.ArchdioceseAdmin); }
        catch (ForbiddenException) { if (!parish.PubliclyListed || parish.Lifecycle != "Active") throw; }
        _ = access.UserId;
        if (!Enum.IsDefined(input.Kind) || input.Language is not ("en" or "fr" or "ar"))
            throw new DomainException("Error.Invalid");
        var subject = Guard.Required(input.SubjectName, "Subject", 200);
        ValidateFacts(input.FactsJson);
        return await operations.RunAsync(input.ParishId, input.OperationId, "Case.Create", input, async () =>
        {
            var record = new ServiceCase { OrgId = parish.OrgId, ParishId = input.ParishId,
                RequesterUserId = access.UserId, Kind = input.Kind, SubjectName = subject,
                Reference = "PL-" + Guid.NewGuid().ToString("N").ToUpperInvariant(), Language = input.Language,
                Stage = input.Submit ? CaseStage.Received : CaseStage.Draft, SuppliedFactsJson = input.FactsJson };
            db.ServiceCases.Add(record);
            History(record, "Create", "", access.UserId, null, null, null, null, null);
            await db.SaveChangesAsync();
            return new(record.Id, record.Revision);
        });
    }

    public async Task<CaseView?> GetAsync(Guid id)
    {
        var record = await db.ServiceCases.IgnoreQueryFilters().AsNoTracking().SingleOrDefaultAsync(c => c.Id == id);
        if (record is null) return null;
        var office = false;
        try { await access.OfficeAsync(record.ParishId); office = true; } catch (ForbiddenException) { }
        if (!office && record.RequesterUserId != access.UserId) return null;
        var privatePastoral = record.Kind == ServiceKind.SickVisit && record.RequesterUserId != access.UserId && tenant.ActingRole != "Priest";
        var history = (await db.CaseHistories.IgnoreQueryFilters().AsNoTracking().Where(h => h.CaseId == id).ToListAsync())
            .OrderBy(h => h.CreatedAt).Select(h => new TimelineItem(h.Action, h.ToState,
                office ? h.ActorUserId : "", office ? h.AuthorityUserId : null,
                h.ApplicantMessage, office && !privatePastoral ? h.InternalNote : null, h.CreatedAt,
                office ? h.InstructionAtUtc : null)).ToList();
        return new(record.Id, record.ParishId, record.Reference, record.SubjectName, record.Kind, record.Stage,
            record.Revision, record.Language, record.Kind == ServiceKind.SickVisit && record.RequesterUserId != access.UserId &&
                tenant.ActingRole != "Priest" ? "{}" : record.SuppliedFactsJson, record.Disputed,
            record.ResponsiblePriestName, record.RegisterReference, history);
    }

    public async Task<OperationResult> SaveDraftAsync(Guid id, long revision, string subject, string facts, string language, bool submit, Guid operationId)
    {
        var record = await db.ServiceCases.IgnoreQueryFilters().SingleOrDefaultAsync(c => c.Id == id && c.RequesterUserId == access.UserId)
            ?? throw new ForbiddenException("Error.Unavailable");
        ValidateFacts(facts);
        if (language is not ("en" or "fr" or "ar")) throw new DomainException("Error.Invalid");
        return await operations.RunAsync(record.ParishId, operationId, "Case.SaveDraft", new { id, revision, subject, facts, language, submit }, async () =>
        {
            OperationRunner.Expect(record, revision);
            if (record.Stage != CaseStage.Draft) throw new DomainException("Error.Immutable");
            record.SubjectName = Guard.Required(subject, "Subject", 200); record.SuppliedFactsJson = facts; record.Language = language;
            record.Stage = submit ? CaseStage.Received : CaseStage.Draft; record.UpdatedAtUtc = DateTimeOffset.UtcNow;
            History(record, submit ? "Submit" : "SaveDraft", "Draft", access.UserId, null, null, null, null, null);
            await db.SaveChangesAsync(); return new(record.Id, record.Revision);
        });
    }

    public async Task<IReadOnlyList<CaseView>> ListAsync()
    {
        var ids = await db.ServiceCases.IgnoreQueryFilters().AsNoTracking().Where(c => c.RequesterUserId == access.UserId ||
            c.OrgId == tenant.OrgId && tenant.ParishIds.Contains(c.ParishId)).Select(c => c.Id).ToListAsync();
        var result = new List<CaseView>();
        foreach (var id in ids)
            if (await GetAsync(id) is { } view) result.Add(view);
        return result;
    }

    public async Task<OperationResult> DecideAsync(CaseDecision input)
    {
        var record = await db.ServiceCases.IgnoreQueryFilters().SingleOrDefaultAsync(c => c.Id == input.Id)
            ?? throw new ForbiddenException("Error.Unavailable");
        var ownerAction = input.Action is "Submit" or "Withdraw";
        if (ownerAction && record.RequesterUserId != access.UserId) throw new ForbiddenException("Error.Unavailable");
        if (!ownerAction) await access.OfficeAsync(record.ParishId);
        return await operations.RunAsync(record.ParishId, input.OperationId, "Case." + input.Action, input, async () =>
        {
            OperationRunner.Expect(record, input.Revision);
            if (record.Disputed && input.Action != "ResolveDispute") throw new DomainException("Error.Disputed");
            var from = record.Stage.ToString();
            string? authority = null;
            switch (input.Action)
            {
                case "Submit":
                    if (record.Stage != CaseStage.Draft) throw new DomainException("Error.State");
                    record.Stage = CaseStage.Received; break;
                case "Withdraw":
                    if (record.Stage is not (CaseStage.Draft or CaseStage.Received)) throw new DomainException("Error.State");
                    record.Stage = CaseStage.Cancelled; break;
                case "Accept":
                    if (record.Stage is not (CaseStage.Received or CaseStage.NeedsInformation)) throw new DomainException("Error.State");
                    authority = await PriestAuthorityAsync(record, input, "Accept");
                    record.ResponsiblePriestUserId = authority;
                    record.ResponsiblePriestName = await db.Users.Where(u => u.Id == authority).Select(u => u.DisplayName).SingleAsync();
                    var approved = await db.ParishPolicies.SingleOrDefaultAsync(p => p.ParishId == record.ParishId && p.ReligiousRequirementsApproved);
                    if (approved is not null && record.RequiredEvidenceSnapshotJson is null)
                    { record.RequiredEvidenceSnapshotJson = approved.RequiredEvidenceJson; record.RequirementsPolicyRevision = approved.Revision; }
                    record.Stage = CaseStage.Preparation; break;
                case "NeedsInformation":
                    if (record.Stage is CaseStage.Registered or CaseStage.Cancelled or CaseStage.Declined or CaseStage.Draft)
                        throw new DomainException("Error.State");
                    Guard.Required(input.ApplicantMessage, "Message", 2000);
                    record.ResumeStage = record.Stage;
                    record.Stage = CaseStage.NeedsInformation; break;
                case "Resume":
                    if (record.Stage != CaseStage.NeedsInformation || record.ResumeStage is null) throw new DomainException("Error.State");
                    record.Stage = record.ResumeStage.Value; record.ResumeStage = null; break;
                case "Schedule":
                    if (record.Stage != CaseStage.Preparation || input.ActualAtUtc is null || input.ActualAtUtc <= DateTimeOffset.UtcNow)
                        throw new DomainException("Error.State");
                    await access.RequireAsync(record.ParishId, SystemRole.Priest);
                    await RequirementsAsync(record);
                    record.ScheduledAtUtc = input.ActualAtUtc; record.Stage = CaseStage.Scheduled; break;
                case "Celebrate":
                    if (record.Stage != CaseStage.Scheduled || input.ActualAtUtc is null || input.ActualAtUtc > DateTimeOffset.UtcNow)
                        throw new DomainException("Error.State");
                    record.CelebrantName = Guard.Required(input.CelebrantName, "Celebrant", 200);
                    record.CelebratedAtUtc = input.ActualAtUtc; record.Stage = CaseStage.Celebrated; break;
                case "Postpone":
                    await access.RequireAsync(record.ParishId, SystemRole.Priest);
                    if (record.Stage != CaseStage.Scheduled) throw new DomainException("Error.State");
                    Guard.Required(input.ApplicantMessage, "Applicant explanation", 2000);
                    record.ScheduledAtUtc = null; record.Stage = CaseStage.Preparation; break;
                case "CorrectEntry":
                    if (record.Stage != CaseStage.Celebrated) throw new DomainException("Error.State");
                    record.SubjectName = Guard.Required(input.CorrectedSubjectName, "Corrected supplied subject name", 200);
                    Guard.Required(input.InternalNote, "Correction evidence", 2000); break;
                case "SubmitEntry":
                    if (record.Stage != CaseStage.Celebrated) throw new DomainException("Error.State");
                    await RequirementsAsync(record); record.Stage = CaseStage.EntryReview; break;
                case "ReturnEntry":
                    await access.RequireAsync(record.ParishId, SystemRole.Priest);
                    if (record.Stage != CaseStage.EntryReview) throw new DomainException("Error.State");
                    Guard.Required(input.ApplicantMessage, "Message", 2000);
                    record.Stage = CaseStage.Celebrated; break;
                case "Register":
                    if (record.Stage != CaseStage.EntryReview || record.CelebratedAtUtc is null) throw new DomainException("Error.State");
                    authority = await PriestAuthorityAsync(record, input, "Register");
                    await RequirementsAsync(record);
                    var policy = await PolicyAsync(record.ParishId);
                    if (!policy.ReligiousRequirementsApproved || string.IsNullOrWhiteSpace(policy.RegisterSeries))
                        throw new DomainException("Error.PolicyRequired");
                    // Incrementing the concurrency-protected policy row serializes this register series.
                    record.RegisterReference = policy.RegisterSeries + "/" + policy.NextRegisterNumber++;
                    record.OfficialSnapshotJson = JsonSerializer.Serialize(new { record.SubjectName, record.SuppliedFactsJson,
                        record.CelebratedAtUtc, record.CelebrantName, record.RegisterReference, PolicyVersion = policy.Revision });
                    record.Stage = CaseStage.Registered; break;
                case "Decline":
                case "Cancel":
                    if (record.Stage is CaseStage.Registered or CaseStage.Celebrated or CaseStage.EntryReview or CaseStage.Cancelled or CaseStage.Declined)
                        throw new DomainException("Error.Immutable");
                    authority = await PriestAuthorityAsync(record, input, "Cancel");
                    Guard.Required(input.ApplicantMessage, "Message", 2000);
                    record.Stage = input.Action == "Decline" ? CaseStage.Declined : CaseStage.Cancelled; break;
                case "Dispute":
                    await access.RequireAsync(record.ParishId, SystemRole.Priest);
                    Guard.Required(input.InternalNote, "Reason", 2000); record.Disputed = true; break;
                case "ResolveDispute":
                    await access.RequireAsync(record.ParishId, SystemRole.Priest);
                    Guard.Required(input.InternalNote, "Reason", 2000); record.Disputed = false; break;
                default: throw new DomainException("Error.State");
            }
            History(record, input.Action, from, access.UserId, authority, input.InternalNote, input.ApplicantMessage,
                input.InstructionAtUtc, input.InstructionChannel);
            Notify(record.RequesterUserId, record, input.OperationId, "M01");
            if (authority is not null && authority != access.UserId) Notify(authority, record, input.OperationId, "M03");
            await db.SaveChangesAsync();
            return new(record.Id, record.Revision);
        });
    }

    private async Task<string> PriestAuthorityAsync(ServiceCase record, CaseDecision input, string stage)
    {
        var assignment = await access.RequireAsync(record.ParishId, SystemRole.Priest, SystemRole.Secretary);
        if (assignment.Role == SystemRole.Priest) return access.UserId;
        // Case acceptance is the recorded owner decision. Extensions are separately approved per stage.
        if (stage != "Accept" && !(stage == "Register" && (await PolicyAsync(record.ParishId)).AllowProxyEntryApproval))
            throw new ForbiddenException("Error.ProxyStage");
        if (!input.PriorInstructionConfirmed || string.IsNullOrWhiteSpace(input.InternalNote) ||
            string.IsNullOrWhiteSpace(input.InstructionChannel) || string.IsNullOrWhiteSpace(input.PriestUserId))
            throw new DomainException("Error.PriorInstruction");
        if (input.InstructionAtUtc > DateTimeOffset.UtcNow) throw new DomainException("Error.Invalid");
        var eligible = (await db.Memberships.IgnoreQueryFilters().AsNoTracking().Where(m =>
            m.UserId == input.PriestUserId && m.ParishId == record.ParishId && m.OrgId == record.OrgId && m.Role == SystemRole.Priest)
            .ToListAsync()).Any(m => m.IsEffective(DateTimeOffset.UtcNow) &&
                (input.InstructionAtUtc is null || m.StartsAtUtc is null || m.StartsAtUtc <= input.InstructionAtUtc));
        if (!eligible) throw new ForbiddenException("Error.PriestAssignment");
        return input.PriestUserId;
    }

    internal async Task<ParishPolicy> PolicyAsync(Guid parish) => await db.ParishPolicies.SingleOrDefaultAsync(p => p.ParishId == parish)
        ?? throw new DomainException("Error.PolicyRequired");

    private async Task RequirementsAsync(ServiceCase record)
    {
        if (!Religious.Contains(record.Kind)) return;
        var policy = await PolicyAsync(record.ParishId);
        if (!policy.ReligiousRequirementsApproved) throw new DomainException("Error.PolicyRequired");
        if (record.RequiredEvidenceSnapshotJson is null)
        { record.RequiredEvidenceSnapshotJson = policy.RequiredEvidenceJson; record.RequirementsPolicyRevision = policy.Revision; }
        var required = JsonSerializer.Deserialize<string[]>(record.RequiredEvidenceSnapshotJson) ?? [];
        var evidence = await db.CaseEvidence.Where(e => e.CaseId == record.Id).ToListAsync();
        var replaced = evidence.Where(e => e.ReplacesId != null).Select(e => e.ReplacesId!.Value).ToHashSet();
        if (required.Any(name => !evidence.Any(e => e.Requirement == name && !replaced.Contains(e.Id) &&
            e.Status is EvidenceStatus.Verified or EvidenceStatus.Waived))) throw new DomainException("Error.EvidenceRequired");
    }

    internal void History(ServiceCase record, string action, string from, string actor, string? authority,
        string? note, string? message, DateTimeOffset? instructionAt, string? channel) => db.CaseHistories.Add(new CaseHistory
    {
        OrgId = record.OrgId, ParishId = record.ParishId, CaseId = record.Id, Revision = action == "Create" ? 1 : record.Revision + 1,
        Action = action, FromState = from, ToState = record.Stage.ToString(), ActorUserId = actor, AuthorityUserId = authority,
        InternalNote = Guard.Optional(note, "Note", 2000), ApplicantMessage = Guard.Optional(message, "Message", 2000),
        InstructionAtUtc = instructionAt, InstructionChannel = channel, SnapshotJson = JsonSerializer.Serialize(record)
    });

    private void Notify(string recipient, ServiceCase record, Guid operationId, string code)
    {
        if (string.IsNullOrWhiteSpace(recipient)) return;
        if (recipient.StartsWith("guest:", StringComparison.Ordinal)) return;
        db.AccountNotifications.Add(new AccountNotification { RecipientUserId = recipient, ParishId = record.ParishId,
            RecordId = record.Id, OperationId = operationId, MessageCode = code });
    }

    private static void ValidateFacts(string json)
    {
        if (json.Length > 10000) throw new DomainException("Error.Invalid");
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.ValueKind != JsonValueKind.Object || doc.RootElement.EnumerateObject().Any(p =>
                p.Name.Contains("password", StringComparison.OrdinalIgnoreCase) || p.Name.Contains("token", StringComparison.OrdinalIgnoreCase)))
                throw new DomainException("Error.Invalid");
        }
        catch (JsonException) { throw new DomainException("Error.Invalid"); }
    }
}
