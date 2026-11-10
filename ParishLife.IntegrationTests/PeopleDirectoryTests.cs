// Purpose: verifies office people search and audited people exports (P07) through real local services and storage.
// Main tests: case/mark-insensitive Latin and Arabic matching without rewriting spellings; export needs exports.manage, previews count and
// exclusions, neutralizes spreadsheet formulas and logs exporter, purpose and count.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class PeopleDirectoryTests
{
    [Fact]
    public async Task Search_ignores_case_and_marks_and_exports_are_authorized_previewed_and_logged()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var office = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        var exporter = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(exporter), Allows = [Permissions.PeopleRead, Permissions.ExportsManage], StartsAt = f.Clock.Now
        }, default);
        var people = f.Services.GetRequiredService<PeopleService>();
        var directory = f.Services.GetRequiredService<PeopleDirectoryService>();
        f.AsAppointment(f.Other, office.Id);
        foreach (var (given, family, contact) in new[] { ("Élie", "Haddad", "=HYPERLINK(\"x\")"), ("مُحَمَّد", "Isolated", null), ("Eliana", "Other", "eliana@fixture.example") })
            await people.CreateAsync(staff.Parish, new CreatePersonDto { OperationId = Guid.NewGuid(), GivenName = given, FamilyName = family, Contact = contact }, default);

        Assert.Equal("Élie", Assert.Single(await directory.SearchAsync(staff.Parish, "ELIE hadd", false, 25, default)).GivenName);
        Assert.Equal("مُحَمَّد", Assert.Single(await directory.SearchAsync(staff.Parish, "محمد", false, 25, default)).GivenName);
        Assert.Equal(2, (await directory.SearchAsync(staff.Parish, "eli", false, 25, default)).Count);
        await Assert.ThrowsAsync<DomainException>(() => directory.PreviewExportAsync(staff.Parish, ["GivenName"], false, default));

        f.As(exporter);
        var preview = await directory.PreviewExportAsync(staff.Parish, ["GivenName", "Contact"], false, default);
        Assert.Equal(3, preview.Count);
        Assert.Contains("pastoral notes and concerns", preview.Excluded);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => directory.PreviewExportAsync(staff.Parish, ["Password"], false, default))).Code);
        var csv = await directory.ExportAsync(staff.Parish, new PeopleExportDto
        {
            OperationId = Guid.NewGuid(), Purpose = "Isolated mailing review", Columns = ["GivenName", "Contact"]
        }, default);
        Assert.StartsWith("GivenName,Contact\r\n", csv, StringComparison.Ordinal);
        Assert.Contains("Élie,\"'=HYPERLINK(\"\"x\"\")\"\r\n", csv, StringComparison.Ordinal);
        var log = Assert.Single(await f.Services.GetRequiredService<IRecordTransactions>().CollectAsync<ExportLog>(
            new RecordScope { Area = RecordArea.Parish, OwnerId = staff.Parish }, "exportLog", default, 10)).Value;
        Assert.Equal((exporter, "Isolated mailing review", 3), (log.By, log.Purpose, log.Count));
    }
}
