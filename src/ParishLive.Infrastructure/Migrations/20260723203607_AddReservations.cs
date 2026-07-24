using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParishLive.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddReservations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Reservations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    GroupId = table.Column<Guid>(type: "TEXT", nullable: false),
                    VenueId = table.Column<Guid>(type: "TEXT", nullable: false),
                    RequestedByUserId = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    StartUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    EndUtc = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    ExpectedAttendees = table.Column<int>(type: "INTEGER", nullable: false),
                    WorkflowDefinitionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CurrentStateId = table.Column<Guid>(type: "TEXT", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reservations", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ReservationStateHistory",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ReservationId = table.Column<Guid>(type: "TEXT", nullable: false),
                    FromStateId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ToStateId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ActionCode = table.Column<string>(type: "TEXT", nullable: false),
                    ActorUserId = table.Column<string>(type: "TEXT", nullable: false),
                    Note = table.Column<string>(type: "TEXT", nullable: true),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReservationStateHistory", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Venues",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Capacity = table.Column<int>(type: "INTEGER", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    OrgId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ParishId = table.Column<Guid>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Venues", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_CurrentStateId",
                table: "Reservations",
                column: "CurrentStateId");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_ParishId_StartUtc",
                table: "Reservations",
                columns: new[] { "ParishId", "StartUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_ReservationStateHistory_ReservationId",
                table: "ReservationStateHistory",
                column: "ReservationId");

            migrationBuilder.CreateIndex(
                name: "IX_Venues_ParishId",
                table: "Venues",
                column: "ParishId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Reservations");

            migrationBuilder.DropTable(
                name: "ReservationStateHistory");

            migrationBuilder.DropTable(
                name: "Venues");
        }
    }
}
