using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParishLive.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReviewedFinalDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "FinalContent",
                table: "Certificates",
                type: "BLOB",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinalFileName",
                table: "Certificates",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FinalMediaType",
                table: "Certificates",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FinalContent",
                table: "Certificates");

            migrationBuilder.DropColumn(
                name: "FinalFileName",
                table: "Certificates");

            migrationBuilder.DropColumn(
                name: "FinalMediaType",
                table: "Certificates");
        }
    }
}
