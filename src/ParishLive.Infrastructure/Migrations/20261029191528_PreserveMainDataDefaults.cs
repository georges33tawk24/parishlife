using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ParishLive.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class PreserveMainDataDefaults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Main had no active/accepted flags. Revision zero identifies only rows that predate
            // these columns; never reactivate an appointment created or changed under the new model.
            migrationBuilder.Sql("UPDATE Memberships SET IsActive = 1, Accepted = 1, Revision = 1 WHERE Revision = 0;");
            migrationBuilder.Sql("UPDATE Venues SET IsServiceable = 1, Revision = 1 WHERE Revision = 0;");
            migrationBuilder.Sql("UPDATE Reservations SET Revision = 1 WHERE Revision = 0;");
            migrationBuilder.Sql("UPDATE Events SET Revision = 1, ConsentVersion = CASE WHEN ConsentVersion = '' THEN 'legacy-unreviewed' ELSE ConsentVersion END WHERE Revision = 0;");
            migrationBuilder.Sql("UPDATE Parishes SET Lifecycle = 'Active' WHERE Lifecycle = '';");
            migrationBuilder.Sql("UPDATE Parishes SET TimeZone = 'Asia/Beirut' WHERE TimeZone = '';");
            migrationBuilder.Sql("UPDATE Parishes SET Bundle = 'Complete' WHERE Bundle = '';");
            migrationBuilder.Sql("UPDATE Parishes SET GuestRequestKindsJson = '[]' WHERE GuestRequestKindsJson = '';");
            migrationBuilder.Sql("UPDATE AspNetUsers SET InterfaceLanguage = 'en' WHERE InterfaceLanguage = '';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data normalization has no safe destructive inverse.
        }
    }
}
