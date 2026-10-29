using ParishLive.Domain.Common;

namespace ParishLive.Domain.Entities;

public abstract class VersionedRecord : TenantEntity
{
    public long Revision { get; set; } = 1;
    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public enum CaseStage { Draft, Received, NeedsInformation, Preparation, Scheduled, Celebrated, EntryReview, Registered, Declined, Cancelled }
public enum ServiceKind { General, Baptism, Communion, Confirmation, Marriage, Funeral, Certificate, MassIntention, Blessing, SickVisit, PriestAppointment }
public enum EvidenceStatus { Uploaded, PaperReceived, UnderReview, Verified, Rejected, Expired, Waived }
public enum CertificateStage { Prepared, PriestApproved, Signed, AwaitingBishop, Returned, Authorized, Issued, Released, Collected, Revoked }
public enum PlaceStatus { Reserved, Waitlisted, Confirmed, Cancelled, NeedsReconfirmation }
public enum MovementKind { Opening, Receipt, Expense, Transfer, Refund, Reversal }

public sealed class ParishPolicy : VersionedRecord
{
    public string ApprovalReference { get; set; } = "";
    public string ApprovedByUserId { get; set; } = "";
    public bool ReligiousRequirementsApproved { get; set; }
    public bool OfficialTemplatesApproved { get; set; }
    public bool FinancePolicyApproved { get; set; }
    public bool SafeguardingPolicyApproved { get; set; }
    public bool BishopReviewRequired { get; set; } = true;
    public bool AllowProxyEntryApproval { get; set; }
    public bool AllowProxyCertificateApproval { get; set; }
    public string RequiredEvidenceJson { get; set; } = "[]";
    public string? RegisterSeries { get; set; }
    public long NextRegisterNumber { get; set; } = 1;
    public string? SafeguardingLeadUserId { get; set; }
}

public sealed class ServiceCase : VersionedRecord
{
    public string Reference { get; set; } = "";
    public string RequesterUserId { get; set; } = "";
    public string SubjectName { get; set; } = "";
    public Guid? PersonId { get; set; }
    public ServiceKind Kind { get; set; }
    public CaseStage Stage { get; set; }
    public CaseStage? ResumeStage { get; set; }
    public string Language { get; set; } = "en";
    public string Origin { get; set; } = "Account";
    public string SuppliedFactsJson { get; set; } = "{}";
    public string? ResponsiblePriestUserId { get; set; }
    public string? ResponsiblePriestName { get; set; }
    public DateTimeOffset? CelebratedAtUtc { get; set; }
    public DateTimeOffset? ScheduledAtUtc { get; set; }
    public string? CelebrantName { get; set; }
    public string? RegisterReference { get; set; }
    public string? OfficialSnapshotJson { get; set; }
    public bool Disputed { get; set; }
    public string? RequiredEvidenceSnapshotJson { get; set; }
    public long? RequirementsPolicyRevision { get; set; }
}

/// <summary>Restricted history. Never copied into general audit or applicant notifications.</summary>
public sealed class CaseHistory : TenantEntity
{
    public Guid CaseId { get; set; }
    public long Revision { get; set; }
    public string Action { get; set; } = "";
    public string FromState { get; set; } = "";
    public string ToState { get; set; } = "";
    public string ActorUserId { get; set; } = "";
    public string? AuthorityUserId { get; set; }
    public string? InternalNote { get; set; }
    public string? ApplicantMessage { get; set; }
    public DateTimeOffset? InstructionAtUtc { get; set; }
    public string? InstructionChannel { get; set; }
    public string SnapshotJson { get; set; } = "{}";
}

public sealed class CaseEvidence : VersionedRecord
{
    public Guid CaseId { get; set; }
    public string Requirement { get; set; } = "";
    public string OriginalFileName { get; set; } = "";
    public string MediaType { get; set; } = "";
    public byte[]? Content { get; set; }
    public EvidenceStatus Status { get; set; }
    public Guid? ReplacesId { get; set; }
    public string SuppliedByUserId { get; set; } = "";
    public string? ReviewedByUserId { get; set; }
    public string? ReviewReason { get; set; }
}

public sealed class CertificateRecord : VersionedRecord
{
    public Guid SourceCaseId { get; set; }
    public string RequesterUserId { get; set; } = "";
    public CertificateStage Stage { get; set; }
    public string Language { get; set; } = "en";
    public int DocumentVersion { get; set; } = 1;
    public string SnapshotJson { get; set; } = "{}";
    public string PriestUserId { get; set; } = "";
    public string PriestName { get; set; } = "";
    public string? SignedEvidenceReference { get; set; }
    public string? BishopUserId { get; set; }
    public string? RecipientUserId { get; set; }
    public string? RecipientAuthority { get; set; }
    public DateTimeOffset? ReleaseExpiresAtUtc { get; set; }
    public DateTimeOffset? CollectedAtUtc { get; set; }
    public string? CollectionReference { get; set; }
    public byte[]? FinalContent { get; set; }
    public string? FinalFileName { get; set; }
    public string? FinalMediaType { get; set; }
}

/// <summary>Operation identity and payload are committed with the primary result.</summary>
public sealed class OperationReceipt : TenantEntity
{
    public string ActorUserId { get; set; } = "";
    public Guid OperationId { get; set; }
    public string Action { get; set; } = "";
    public string PayloadHash { get; set; } = "";
    public Guid ResultId { get; set; }
    public long ResultRevision { get; set; }
}

public sealed class AccountNotification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string RecipientUserId { get; set; } = "";
    public Guid ParishId { get; set; }
    public Guid RecordId { get; set; }
    public string MessageCode { get; set; } = "M01";
    public Guid OperationId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? ReadAtUtc { get; set; }
    public string Channel { get; set; } = "InApp";
}

public sealed class PersonRecord : VersionedRecord
{
    public string SuppliedName { get; set; } = "";
    public string? ArabicName { get; set; }
    public string? FrenchName { get; set; }
    public string? BirthDate { get; set; }
    public string DatePrecision { get; set; } = "Unknown";
    public string Status { get; set; } = "Provisional";
    public string Source { get; set; } = "";
    public string? LinkedUserId { get; set; }
    public Guid? HouseholdId { get; set; }
    public bool DirectoryOptIn { get; set; }
}

public sealed class HouseholdRecord : VersionedRecord
{
    public string Label { get; set; } = "";
    public Guid? ContactPersonId { get; set; }
    public string? Address { get; set; }
}

public sealed class RepresentationGrant : VersionedRecord
{
    public Guid SubjectPersonId { get; set; }
    public string RepresentativeUserId { get; set; } = "";
    public string Purpose { get; set; } = "";
    public string VerificationReference { get; set; } = "";
    public string VerifiedByUserId { get; set; } = "";
    public DateTimeOffset? ExpiresAtUtc { get; set; }
    public bool Revoked { get; set; }
}

public sealed class ParishFollow
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string UserId { get; set; } = "";
    public Guid ParishId { get; set; }
    public bool IsPrimary { get; set; }
}

public sealed class MembershipReview : VersionedRecord
{
    public string ApplicantUserId { get; set; } = "";
    public string SuppliedName { get; set; } = "";
    public Guid? PersonId { get; set; }
    public string Status { get; set; } = "Submitted";
    public string? VerificationReference { get; set; }
    public string? ReviewerUserId { get; set; }
    public string? ApplicantMessage { get; set; }
}

public sealed class MinistryApplication : VersionedRecord
{
    public Guid GroupId { get; set; }
    public string ApplicantUserId { get; set; } = "";
    public string Status { get; set; } = "Submitted";
    public bool IsDeparture { get; set; }
    public string? PrivateReason { get; set; }
}

public sealed class MeetingAttendance : VersionedRecord
{
    public Guid EventId { get; set; }
    public Guid GroupId { get; set; }
    public string ParticipantUserId { get; set; } = "";
    public string Status { get; set; } = "NotRecorded";
    public bool PeriodClosed { get; set; }
    public string? PrivateReason { get; set; }
}

public sealed class EventAdmission : VersionedRecord
{
    public Guid EventId { get; set; }
    public string ParticipantUserId { get; set; } = "";
    public string ParticipantName { get; set; } = "";
    public string RequesterUserId { get; set; } = "";
    public PlaceStatus Place { get; set; }
    public DateOnly? BirthDate { get; set; }
    public bool ConsentVerified { get; set; }
    public string? ConsentVersion { get; set; }
    public string? ConsentEvidenceReference { get; set; }
    public string? ApprovedCollectorsJson { get; set; }
    public bool IndependentExitApproved { get; set; }
    public DateTimeOffset? ArrivedAtUtc { get; set; }
    public DateTimeOffset? ExitedAtUtc { get; set; }
}

public sealed class AttendanceMovement : TenantEntity
{
    public Guid AdmissionId { get; set; }
    public Guid EventId { get; set; }
    public string Action { get; set; } = "";
    public DateTimeOffset ActualAtUtc { get; set; }
    public string ActorUserId { get; set; } = "";
    public string? EvidenceReference { get; set; }
    public bool PaperReconciled { get; set; }
}

public sealed class LedgerMovement : TenantEntity
{
    public MovementKind Kind { get; set; }
    public string Currency { get; set; } = "";
    // Integer minor units: USD cents, LBP whole units. No floating point or mixed-currency sum.
    public long Units { get; set; }
    public string Account { get; set; } = "";
    public string? DestinationAccount { get; set; }
    public string Fund { get; set; } = "";
    public string SourceReference { get; set; } = "";
    public string ActorUserId { get; set; } = "";
    public string? ApprovedByUserId { get; set; }
    public Guid? ReversesId { get; set; }
    public DateTimeOffset ActualAtUtc { get; set; }
}

public sealed class MovementAllocation : TenantEntity
{
    public Guid MovementId { get; set; }
    public string PurposeReference { get; set; } = "";
    public string Fund { get; set; } = "";
    public long Units { get; set; }
}

public sealed class FinancialRequest : VersionedRecord
{
    public MovementKind Kind { get; set; }
    public string Currency { get; set; } = "";
    public long Units { get; set; }
    public string Account { get; set; } = "";
    public string? DestinationAccount { get; set; }
    public string Fund { get; set; } = "";
    public string SourceReference { get; set; } = "";
    public string SubmittedByUserId { get; set; } = "";
    public string? ApprovedByUserId { get; set; }
    public string Status { get; set; } = "Submitted";
    public Guid? MovementId { get; set; }
    public Guid? ReversesId { get; set; }
}

public sealed class GivingBatch : VersionedRecord
{
    public DateTimeOffset? CollectedAtUtc { get; set; }
    public string OpenedByUserId { get; set; } = "";
    public string SourceReference { get; set; } = "";
    public string Status { get; set; } = "Open";
    public string? VerifiedByUserId { get; set; }
    public long? VerifiedRevision { get; set; }
    public string? ObservationJson { get; set; }
}

public sealed class GivingLine : TenantEntity
{
    public Guid BatchId { get; set; }
    public string Currency { get; set; } = "";
    public long Units { get; set; }
    public string Fund { get; set; } = "";
    public string Method { get; set; } = "Cash";
    public string? HouseholdReference { get; set; }
    public Guid? MovementId { get; set; }
}

public sealed class PrivateNotebook : VersionedRecord
{
    public string AuthorUserId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Body { get; set; } = "";
    public string Audience { get; set; } = "Author";
    public string? AssigneeUserId { get; set; }
    public string Status { get; set; } = "Open";
}

public sealed class ConcernRecord : VersionedRecord
{
    public string SubmitterUserId { get; set; } = "";
    public bool AnonymousToReviewers { get; set; }
    public bool Sensitive { get; set; }
    public string Narrative { get; set; } = "";
    public string Status { get; set; } = "Submitted";
}

public sealed class ConcernAccess : TenantEntity
{
    public Guid ConcernId { get; set; }
    public string ReviewerUserId { get; set; } = "";
    public bool CanViewSensitive { get; set; }
    public bool CanViewIdentity { get; set; }
    public bool Conflicted { get; set; }
    public bool Revoked { get; set; }
}

public sealed class ConcernLog : TenantEntity
{
    public Guid ConcernId { get; set; }
    public string ActorUserId { get; set; } = "";
    public string Action { get; set; } = "";
    public string? ApplicantReply { get; set; }
    public string? ReviewerNote { get; set; }
}

public sealed class ContentPage : VersionedRecord
{
    public string Slug { get; set; } = "";
    public string DraftJson { get; set; } = "{}";
    public string? PublishedJson { get; set; }
    public string EditorUserId { get; set; } = "";
    public string? PublisherUserId { get; set; }
    public long? PublishedRevision { get; set; }
}
