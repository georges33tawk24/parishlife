using ParishLive.Domain.Entities;

namespace ParishLive.Application.Operations;

public sealed record NewCase(Guid ParishId, ServiceKind Kind, string SubjectName, string Language,
    string FactsJson, bool Submit, Guid OperationId);
public sealed record CaseDecision(Guid Id, long Revision, Guid OperationId, string Action,
    string? ApplicantMessage = null, string? InternalNote = null, string? PriestUserId = null,
    bool PriorInstructionConfirmed = false, DateTimeOffset? InstructionAtUtc = null,
    string? InstructionChannel = null, DateTimeOffset? ActualAtUtc = null, string? CelebrantName = null,
    string? CorrectedSubjectName = null);
public sealed record TimelineItem(string Action, string State, string Actor, string? Authority,
    string? Message, string? InternalNote, DateTimeOffset At, DateTimeOffset? InstructionAtUtc);
public sealed record CaseView(Guid Id, Guid ParishId, string Reference, string SubjectName, ServiceKind Kind,
    CaseStage Stage, long Revision, string Language, string FactsJson, bool Disputed,
    string? PriestName, string? RegisterReference, IReadOnlyList<TimelineItem> History);
