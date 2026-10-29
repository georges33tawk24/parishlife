using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParishLive.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AdministrativeSetupGuestAndPinnedRequirements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RequiredEvidenceSnapshotJson",
                table: "ServiceCases",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "RequirementsPolicyRevision",
                table: "ServiceCases",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AdoptionReference",
                table: "Parishes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Bundle",
                table: "Parishes",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "GuestIntakeEnabled",
                table: "Parishes",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "GuestRequestKindsJson",
                table: "Parishes",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Jurisdiction",
                table: "Parishes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SuspendedByRole",
                table: "Parishes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameArabic",
                table: "Organizations",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameFrench",
                table: "Organizations",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "AcceptedAtUtc",
                table: "Memberships",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AppointedByUserId",
                table: "Memberships",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AuthorityReference",
                table: "Memberships",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "MayCreateParishes",
                table: "Memberships",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "AdministrativeChanges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SubmittedByUserId = table.Column<string>(type: "TEXT", nullable: false),
                    PayloadJson = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    ApprovedByUserId = table.Column<string>(type: "TEXT", nullable: true),
                    AppointmentId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Revision = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdministrativeChanges", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AdministrativeRecords",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    OperationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActorUserId = table.Column<string>(type: "TEXT", nullable: false),
                    Action = table.Column<string>(type: "TEXT", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TargetUserId = table.Column<string>(type: "TEXT", nullable: false),
                    TargetId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AuthorityReference = table.Column<string>(type: "TEXT", nullable: false),
                    PayloadHash = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdministrativeRecords", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GuestAccess",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    CaseId = table.Column<Guid>(type: "TEXT", nullable: false),
                    TokenHash = table.Column<string>(type: "TEXT", nullable: false),
                    ExpiresAtUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    Revoked = table.Column<bool>(type: "INTEGER", nullable: false),
                    AssociatedUserId = table.Column<string>(type: "TEXT", nullable: true),
                    AssociationEvidenceReference = table.Column<string>(type: "TEXT", nullable: true),
                    AssociatedByUserId = table.Column<string>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GuestAccess", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdministrativeRecords_ActorUserId_OperationId",
                table: "AdministrativeRecords",
                columns: new[] { "ActorUserId", "OperationId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GuestAccess_ParishId_Id",
                table: "GuestAccess",
                columns: new[] { "ParishId", "Id" });

            migrationBuilder.CreateIndex(
                name: "IX_GuestAccess_TokenHash",
                table: "GuestAccess",
                column: "TokenHash",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdministrativeChanges");

            migrationBuilder.DropTable(
                name: "AdministrativeRecords");

            migrationBuilder.DropTable(
                name: "GuestAccess");

            migrationBuilder.DropColumn(
                name: "RequiredEvidenceSnapshotJson",
                table: "ServiceCases");

            migrationBuilder.DropColumn(
                name: "RequirementsPolicyRevision",
                table: "ServiceCases");

            migrationBuilder.DropColumn(
                name: "AdoptionReference",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "Bundle",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "GuestIntakeEnabled",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "GuestRequestKindsJson",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "Jurisdiction",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "SuspendedByRole",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "NameArabic",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "NameFrench",
                table: "Organizations");

            migrationBuilder.DropColumn(
                name: "AcceptedAtUtc",
                table: "Memberships");

            migrationBuilder.DropColumn(
                name: "AppointedByUserId",
                table: "Memberships");

            migrationBuilder.DropColumn(
                name: "AuthorityReference",
                table: "Memberships");

            migrationBuilder.DropColumn(
                name: "MayCreateParishes",
                table: "Memberships");
        }
    }
}
