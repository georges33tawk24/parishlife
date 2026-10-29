using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParishLive.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PublicIdentityAndMinistryGuards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Lifecycle",
                table: "Parishes",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Locality",
                table: "Parishes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameArabic",
                table: "Parishes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NameFrench",
                table: "Parishes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OfficeContact",
                table: "Parishes",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PubliclyListed",
                table: "Parishes",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TimeZone",
                table: "Parishes",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_MinistryApplications_GroupId_ApplicantUserId_IsDeparture",
                table: "MinistryApplications",
                columns: new[] { "GroupId", "ApplicantUserId", "IsDeparture" },
                unique: true,
                filter: "\"Status\" IN ('Submitted', 'LeaderApproved', 'WithdrawalRequested')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MinistryApplications_GroupId_ApplicantUserId_IsDeparture",
                table: "MinistryApplications");

            migrationBuilder.DropColumn(
                name: "Lifecycle",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "Locality",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "NameArabic",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "NameFrench",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "OfficeContact",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "PubliclyListed",
                table: "Parishes");

            migrationBuilder.DropColumn(
                name: "TimeZone",
                table: "Parishes");
        }
    }
}
