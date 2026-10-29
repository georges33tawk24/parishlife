using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParishLive.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RestrictedConcernHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ConcernLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ConcernId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActorUserId = table.Column<string>(type: "TEXT", nullable: false),
                    Action = table.Column<string>(type: "TEXT", nullable: false),
                    ApplicantReply = table.Column<string>(type: "TEXT", nullable: true),
                    ReviewerNote = table.Column<string>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConcernLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ConcernLogs_ParishId_Id",
                table: "ConcernLogs",
                columns: new[] { "ParishId", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ConcernLogs");
        }
    }
}
