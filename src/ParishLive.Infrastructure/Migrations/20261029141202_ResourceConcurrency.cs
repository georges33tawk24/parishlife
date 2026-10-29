using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParishLive.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ResourceConcurrency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CleanupMinutes",
                table: "Venues",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<bool>(
                name: "IsServiceable",
                table: "Venues",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "Revision",
                table: "Venues",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "SetupMinutes",
                table: "Venues",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "CleanupMinutes",
                table: "Reservations",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "HoldExpiresAtUtc",
                table: "Reservations",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "Revision",
                table: "Reservations",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "SetupMinutes",
                table: "Reservations",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ConsentVersion",
                table: "Events",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsMass",
                table: "Events",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<long>(
                name: "Revision",
                table: "Events",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CleanupMinutes",
                table: "Venues");

            migrationBuilder.DropColumn(
                name: "IsServiceable",
                table: "Venues");

            migrationBuilder.DropColumn(
                name: "Revision",
                table: "Venues");

            migrationBuilder.DropColumn(
                name: "SetupMinutes",
                table: "Venues");

            migrationBuilder.DropColumn(
                name: "CleanupMinutes",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "HoldExpiresAtUtc",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "Revision",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "SetupMinutes",
                table: "Reservations");

            migrationBuilder.DropColumn(
                name: "ConsentVersion",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "IsMass",
                table: "Events");

            migrationBuilder.DropColumn(
                name: "Revision",
                table: "Events");
        }
    }
}
