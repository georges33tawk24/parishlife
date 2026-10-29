using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParishLive.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReviewedParishOperations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "Accepted",
                table: "Memberships",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "EndsAtUtc",
                table: "Memberships",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "GroupId",
                table: "Memberships",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Memberships",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsHeadPriest",
                table: "Memberships",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "Revision",
                table: "Memberships",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StartsAtUtc",
                table: "Memberships",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AccountNotifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    RecipientUserId = table.Column<string>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    RecordId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MessageCode = table.Column<string>(type: "TEXT", nullable: false),
                    OperationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    ReadAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    Channel = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountNotifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AttendanceMovements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AdmissionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    EventId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Action = table.Column<string>(type: "TEXT", nullable: false),
                    ActualAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    ActorUserId = table.Column<string>(type: "TEXT", nullable: false),
                    EvidenceReference = table.Column<string>(type: "TEXT", nullable: true),
                    PaperReconciled = table.Column<bool>(type: "INTEGER", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttendanceMovements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CaseEvidence",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CaseId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Requirement = table.Column<string>(type: "TEXT", nullable: false),
                    OriginalFileName = table.Column<string>(type: "TEXT", nullable: false),
                    MediaType = table.Column<string>(type: "TEXT", nullable: false),
                    Content = table.Column<byte[]>(type: "BLOB", nullable: true),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    ReplacesId = table.Column<Guid>(type: "TEXT", nullable: true),
                    SuppliedByUserId = table.Column<string>(type: "TEXT", nullable: false),
                    ReviewedByUserId = table.Column<string>(type: "TEXT", nullable: true),
                    ReviewReason = table.Column<string>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CaseEvidence", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CaseHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CaseId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    Action = table.Column<string>(type: "TEXT", nullable: false),
                    FromState = table.Column<string>(type: "TEXT", nullable: false),
                    ToState = table.Column<string>(type: "TEXT", nullable: false),
                    ActorUserId = table.Column<string>(type: "TEXT", nullable: false),
                    AuthorityUserId = table.Column<string>(type: "TEXT", nullable: true),
                    InternalNote = table.Column<string>(type: "TEXT", nullable: true),
                    ApplicantMessage = table.Column<string>(type: "TEXT", nullable: true),
                    InstructionAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    InstructionChannel = table.Column<string>(type: "TEXT", nullable: true),
                    SnapshotJson = table.Column<string>(type: "TEXT", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CaseHistories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Certificates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SourceCaseId = table.Column<Guid>(type: "TEXT", nullable: false),
                    RequesterUserId = table.Column<string>(type: "TEXT", nullable: false),
                    Stage = table.Column<int>(type: "INTEGER", nullable: false),
                    Language = table.Column<string>(type: "TEXT", nullable: false),
                    DocumentVersion = table.Column<int>(type: "INTEGER", nullable: false),
                    SnapshotJson = table.Column<string>(type: "TEXT", nullable: false),
                    PriestUserId = table.Column<string>(type: "TEXT", nullable: false),
                    PriestName = table.Column<string>(type: "TEXT", nullable: false),
                    SignedEvidenceReference = table.Column<string>(type: "TEXT", nullable: true),
                    BishopUserId = table.Column<string>(type: "TEXT", nullable: true),
                    RecipientUserId = table.Column<string>(type: "TEXT", nullable: true),
                    RecipientAuthority = table.Column<string>(type: "TEXT", nullable: true),
                    ReleaseExpiresAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    CollectedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    CollectionReference = table.Column<string>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Certificates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ConcernAccess",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ConcernId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ReviewerUserId = table.Column<string>(type: "TEXT", nullable: false),
                    CanViewSensitive = table.Column<bool>(type: "INTEGER", nullable: false),
                    CanViewIdentity = table.Column<bool>(type: "INTEGER", nullable: false),
                    Conflicted = table.Column<bool>(type: "INTEGER", nullable: false),
                    Revoked = table.Column<bool>(type: "INTEGER", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConcernAccess", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Concerns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SubmitterUserId = table.Column<string>(type: "TEXT", nullable: false),
                    AnonymousToReviewers = table.Column<bool>(type: "INTEGER", nullable: false),
                    Sensitive = table.Column<bool>(type: "INTEGER", nullable: false),
                    Narrative = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Concerns", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ContentPages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Slug = table.Column<string>(type: "TEXT", nullable: false),
                    DraftJson = table.Column<string>(type: "TEXT", nullable: false),
                    PublishedJson = table.Column<string>(type: "TEXT", nullable: true),
                    EditorUserId = table.Column<string>(type: "TEXT", nullable: false),
                    PublisherUserId = table.Column<string>(type: "TEXT", nullable: true),
                    PublishedRevision = table.Column<long>(type: "INTEGER", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentPages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EventAdmissions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    EventId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParticipantUserId = table.Column<string>(type: "TEXT", nullable: false),
                    RequesterUserId = table.Column<string>(type: "TEXT", nullable: false),
                    Place = table.Column<int>(type: "INTEGER", nullable: false),
                    BirthDate = table.Column<DateOnly>(type: "TEXT", nullable: true),
                    ConsentVerified = table.Column<bool>(type: "INTEGER", nullable: false),
                    ConsentVersion = table.Column<string>(type: "TEXT", nullable: true),
                    ConsentEvidenceReference = table.Column<string>(type: "TEXT", nullable: true),
                    ApprovedCollectorsJson = table.Column<string>(type: "TEXT", nullable: true),
                    IndependentExitApproved = table.Column<bool>(type: "INTEGER", nullable: false),
                    ArrivedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    ExitedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventAdmissions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FinancialRequests",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Kind = table.Column<int>(type: "INTEGER", nullable: false),
                    Currency = table.Column<string>(type: "TEXT", nullable: false),
                    Units = table.Column<long>(type: "INTEGER", nullable: false),
                    Account = table.Column<string>(type: "TEXT", nullable: false),
                    DestinationAccount = table.Column<string>(type: "TEXT", nullable: true),
                    Fund = table.Column<string>(type: "TEXT", nullable: false),
                    SourceReference = table.Column<string>(type: "TEXT", nullable: false),
                    SubmittedByUserId = table.Column<string>(type: "TEXT", nullable: false),
                    ApprovedByUserId = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    MovementId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ReversesId = table.Column<Guid>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancialRequests", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GivingBatches",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OpenedByUserId = table.Column<string>(type: "TEXT", nullable: false),
                    SourceReference = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    VerifiedByUserId = table.Column<string>(type: "TEXT", nullable: true),
                    VerifiedRevision = table.Column<long>(type: "INTEGER", nullable: true),
                    ObservationJson = table.Column<string>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GivingBatches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GivingLines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    BatchId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Currency = table.Column<string>(type: "TEXT", nullable: false),
                    Units = table.Column<long>(type: "INTEGER", nullable: false),
                    Fund = table.Column<string>(type: "TEXT", nullable: false),
                    Method = table.Column<string>(type: "TEXT", nullable: false),
                    HouseholdReference = table.Column<string>(type: "TEXT", nullable: true),
                    MovementId = table.Column<Guid>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GivingLines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Households",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Label = table.Column<string>(type: "TEXT", nullable: false),
                    ContactPersonId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Address = table.Column<string>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Households", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LedgerMovements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Kind = table.Column<int>(type: "INTEGER", nullable: false),
                    Currency = table.Column<string>(type: "TEXT", nullable: false),
                    Units = table.Column<long>(type: "INTEGER", nullable: false),
                    Account = table.Column<string>(type: "TEXT", nullable: false),
                    DestinationAccount = table.Column<string>(type: "TEXT", nullable: true),
                    Fund = table.Column<string>(type: "TEXT", nullable: false),
                    SourceReference = table.Column<string>(type: "TEXT", nullable: false),
                    ActorUserId = table.Column<string>(type: "TEXT", nullable: false),
                    ApprovedByUserId = table.Column<string>(type: "TEXT", nullable: true),
                    ReversesId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ActualAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LedgerMovements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MeetingAttendance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    EventId = table.Column<Guid>(type: "TEXT", nullable: false),
                    GroupId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParticipantUserId = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    PeriodClosed = table.Column<bool>(type: "INTEGER", nullable: false),
                    PrivateReason = table.Column<string>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MeetingAttendance", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MembershipReviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ApplicantUserId = table.Column<string>(type: "TEXT", nullable: false),
                    SuppliedName = table.Column<string>(type: "TEXT", nullable: false),
                    PersonId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    VerificationReference = table.Column<string>(type: "TEXT", nullable: true),
                    ReviewerUserId = table.Column<string>(type: "TEXT", nullable: true),
                    ApplicantMessage = table.Column<string>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MembershipReviews", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MinistryApplications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    GroupId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ApplicantUserId = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    IsDeparture = table.Column<bool>(type: "INTEGER", nullable: false),
                    PrivateReason = table.Column<string>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MinistryApplications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "MovementAllocations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    MovementId = table.Column<Guid>(type: "TEXT", nullable: false),
                    PurposeReference = table.Column<string>(type: "TEXT", nullable: false),
                    Fund = table.Column<string>(type: "TEXT", nullable: false),
                    Units = table.Column<long>(type: "INTEGER", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MovementAllocations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Operations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActorUserId = table.Column<string>(type: "TEXT", nullable: false),
                    OperationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Action = table.Column<string>(type: "TEXT", nullable: false),
                    PayloadHash = table.Column<string>(type: "TEXT", nullable: false),
                    ResultId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ResultRevision = table.Column<long>(type: "INTEGER", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Operations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishFollows",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    IsPrimary = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishFollows", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ParishPolicies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ApprovalReference = table.Column<string>(type: "TEXT", nullable: false),
                    ApprovedByUserId = table.Column<string>(type: "TEXT", nullable: false),
                    ReligiousRequirementsApproved = table.Column<bool>(type: "INTEGER", nullable: false),
                    OfficialTemplatesApproved = table.Column<bool>(type: "INTEGER", nullable: false),
                    FinancePolicyApproved = table.Column<bool>(type: "INTEGER", nullable: false),
                    SafeguardingPolicyApproved = table.Column<bool>(type: "INTEGER", nullable: false),
                    BishopReviewRequired = table.Column<bool>(type: "INTEGER", nullable: false),
                    AllowProxyEntryApproval = table.Column<bool>(type: "INTEGER", nullable: false),
                    AllowProxyCertificateApproval = table.Column<bool>(type: "INTEGER", nullable: false),
                    RequiredEvidenceJson = table.Column<string>(type: "TEXT", nullable: false),
                    RegisterSeries = table.Column<string>(type: "TEXT", nullable: true),
                    NextRegisterNumber = table.Column<long>(type: "INTEGER", nullable: false),
                    SafeguardingLeadUserId = table.Column<string>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParishPolicies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "People",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SuppliedName = table.Column<string>(type: "TEXT", nullable: false),
                    ArabicName = table.Column<string>(type: "TEXT", nullable: true),
                    FrenchName = table.Column<string>(type: "TEXT", nullable: true),
                    BirthDate = table.Column<string>(type: "TEXT", nullable: true),
                    DatePrecision = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Source = table.Column<string>(type: "TEXT", nullable: false),
                    LinkedUserId = table.Column<string>(type: "TEXT", nullable: true),
                    HouseholdId = table.Column<Guid>(type: "TEXT", nullable: true),
                    DirectoryOptIn = table.Column<bool>(type: "INTEGER", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_People", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PrivateNotebooks",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AuthorUserId = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Body = table.Column<string>(type: "TEXT", nullable: false),
                    Audience = table.Column<string>(type: "TEXT", nullable: false),
                    AssigneeUserId = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrivateNotebooks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RepresentationGrants",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SubjectPersonId = table.Column<Guid>(type: "TEXT", nullable: false),
                    RepresentativeUserId = table.Column<string>(type: "TEXT", nullable: false),
                    Purpose = table.Column<string>(type: "TEXT", nullable: false),
                    VerificationReference = table.Column<string>(type: "TEXT", nullable: false),
                    VerifiedByUserId = table.Column<string>(type: "TEXT", nullable: false),
                    ExpiresAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    Revoked = table.Column<bool>(type: "INTEGER", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RepresentationGrants", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ServiceCases",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Reference = table.Column<string>(type: "TEXT", nullable: false),
                    RequesterUserId = table.Column<string>(type: "TEXT", nullable: false),
                    SubjectName = table.Column<string>(type: "TEXT", nullable: false),
                    PersonId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Kind = table.Column<int>(type: "INTEGER", nullable: false),
                    Stage = table.Column<int>(type: "INTEGER", nullable: false),
                    ResumeStage = table.Column<int>(type: "INTEGER", nullable: true),
                    Language = table.Column<string>(type: "TEXT", nullable: false),
                    Origin = table.Column<string>(type: "TEXT", nullable: false),
                    SuppliedFactsJson = table.Column<string>(type: "TEXT", nullable: false),
                    ResponsiblePriestUserId = table.Column<string>(type: "TEXT", nullable: true),
                    ResponsiblePriestName = table.Column<string>(type: "TEXT", nullable: true),
                    CelebratedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    ScheduledAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: true),
                    CelebrantName = table.Column<string>(type: "TEXT", nullable: true),
                    RegisterReference = table.Column<string>(type: "TEXT", nullable: true),
                    OfficialSnapshotJson = table.Column<string>(type: "TEXT", nullable: true),
                    Disputed = table.Column<bool>(type: "INTEGER", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceCases", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AccountNotifications_RecipientUserId_OperationId_MessageCode",
                table: "AccountNotifications",
                columns: new[] { "RecipientUserId", "OperationId", "MessageCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AttendanceMovements_ParishId_Id",
                table: "AttendanceMovements",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_CaseEvidence_ParishId_Id",
                table: "CaseEvidence",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_CaseHistories_ParishId_Id",
                table: "CaseHistories",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_ParishId_Id",
                table: "Certificates",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_ConcernAccess_ParishId_Id",
                table: "ConcernAccess",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_Concerns_ParishId_Id",
                table: "Concerns",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_ContentPages_ParishId_Id",
                table: "ContentPages",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_EventAdmissions_EventId_ParticipantUserId",
                table: "EventAdmissions",
                columns: new[] { "EventId", "ParticipantUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EventAdmissions_ParishId_Id",
                table: "EventAdmissions",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_FinancialRequests_ParishId_Id",
                table: "FinancialRequests",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_GivingBatches_ParishId_Id",
                table: "GivingBatches",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_GivingLines_ParishId_Id",
                table: "GivingLines",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_Households_ParishId_Id",
                table: "Households",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_LedgerMovements_ParishId_Id",
                table: "LedgerMovements",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_LedgerMovements_ParishId_SourceReference",
                table: "LedgerMovements",
                columns: new[] { "ParishId", "SourceReference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MeetingAttendance_EventId_ParticipantUserId",
                table: "MeetingAttendance",
                columns: new[] { "EventId", "ParticipantUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MeetingAttendance_ParishId_Id",
                table: "MeetingAttendance",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_MembershipReviews_ParishId_Id",
                table: "MembershipReviews",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_MinistryApplications_ParishId_Id",
                table: "MinistryApplications",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_MovementAllocations_ParishId_Id",
                table: "MovementAllocations",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_Operations_ActorUserId_OperationId",
                table: "Operations",
                columns: new[] { "ActorUserId", "OperationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Operations_ParishId_Id",
                table: "Operations",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_ParishFollows_UserId_ParishId",
                table: "ParishFollows",
                columns: new[] { "UserId", "ParishId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParishPolicies_ParishId",
                table: "ParishPolicies",
                column: "ParishId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParishPolicies_ParishId_Id",
                table: "ParishPolicies",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_People_ParishId_Id",
                table: "People",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_People_ParishId_LinkedUserId",
                table: "People",
                columns: new[] { "ParishId", "LinkedUserId" },
                unique: true,
                filter: "\"LinkedUserId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_PrivateNotebooks_ParishId_Id",
                table: "PrivateNotebooks",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_RepresentationGrants_ParishId_Id",
                table: "RepresentationGrants",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceCases_ParishId_Id",
                table: "ServiceCases",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_ServiceCases_Reference",
                table: "ServiceCases",
                column: "Reference",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AccountNotifications");

            migrationBuilder.DropTable(
                name: "AttendanceMovements");

            migrationBuilder.DropTable(
                name: "CaseEvidence");

            migrationBuilder.DropTable(
                name: "CaseHistories");

            migrationBuilder.DropTable(
                name: "Certificates");

            migrationBuilder.DropTable(
                name: "ConcernAccess");

            migrationBuilder.DropTable(
                name: "Concerns");

            migrationBuilder.DropTable(
                name: "ContentPages");

            migrationBuilder.DropTable(
                name: "EventAdmissions");

            migrationBuilder.DropTable(
                name: "FinancialRequests");

            migrationBuilder.DropTable(
                name: "GivingBatches");

            migrationBuilder.DropTable(
                name: "GivingLines");

            migrationBuilder.DropTable(
                name: "Households");

            migrationBuilder.DropTable(
                name: "LedgerMovements");

            migrationBuilder.DropTable(
                name: "MeetingAttendance");

            migrationBuilder.DropTable(
                name: "MembershipReviews");

            migrationBuilder.DropTable(
                name: "MinistryApplications");

            migrationBuilder.DropTable(
                name: "MovementAllocations");

            migrationBuilder.DropTable(
                name: "Operations");

            migrationBuilder.DropTable(
                name: "ParishFollows");

            migrationBuilder.DropTable(
                name: "ParishPolicies");

            migrationBuilder.DropTable(
                name: "People");

            migrationBuilder.DropTable(
                name: "PrivateNotebooks");

            migrationBuilder.DropTable(
                name: "RepresentationGrants");

            migrationBuilder.DropTable(
                name: "ServiceCases");

            migrationBuilder.DropColumn(
                name: "Accepted",
                table: "Memberships");

            migrationBuilder.DropColumn(
                name: "EndsAtUtc",
                table: "Memberships");

            migrationBuilder.DropColumn(
                name: "GroupId",
                table: "Memberships");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Memberships");

            migrationBuilder.DropColumn(
                name: "IsHeadPriest",
                table: "Memberships");

            migrationBuilder.DropColumn(
                name: "Revision",
                table: "Memberships");

            migrationBuilder.DropColumn(
                name: "StartsAtUtc",
                table: "Memberships");
        }
    }
}
