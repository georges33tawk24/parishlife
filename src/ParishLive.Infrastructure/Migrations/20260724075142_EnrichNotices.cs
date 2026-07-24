using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParishLive.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class EnrichNotices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Audience",
                table: "Notices",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Body",
                table: "Notices",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ExpiresAtUtc",
                table: "Notices",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Priority",
                table: "Notices",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "PublishedAtUtc",
                table: "Notices",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "PublishedByUserId",
                table: "Notices",
                type: "TEXT",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Audience",
                table: "Notices");

            migrationBuilder.DropColumn(
                name: "Body",
                table: "Notices");

            migrationBuilder.DropColumn(
                name: "ExpiresAtUtc",
                table: "Notices");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "Notices");

            migrationBuilder.DropColumn(
                name: "PublishedAtUtc",
                table: "Notices");

            migrationBuilder.DropColumn(
                name: "PublishedByUserId",
                table: "Notices");
        }
    }
}
