// Purpose: verifies staged, reviewed CSV people imports (P06) through real local services and storage.
// Main tests: whole-file validation before any write; ambiguous dates need a stated order; repeated source ids and likely duplicates are
// flagged; all-or-nothing by default, valid-rows-only by choice; a re-import of the same source is recognised.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class PeopleImportTests
{
    private const string Csv = "GivenName,FamilyName,BirthDate,Contact,SourceId\n" +
        "Élie,Haddad,1980-01-01,a@fixture.example,R1\n" +
        "\"Marie, Rose\",Khoury,25/12/1975,,R2\n" +
        "Tony,Saad,03/04/1990,,R3\n" +
        ",Nameless,,,R4\n" +
        "Existing,Person,1960-06-06,,R5\n";

    [Fact]
    public async Task Imports_validate_everything_first_and_commit_only_by_explicit_choice()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var importer = await f.CreateVerifiedStaffAsync();
        f.As(f.FirstAdmin);
        await f.Services.GetRequiredService<ParishService>().GrantAsync(staff.Parish, new GrantAccessDto
        {
            OperationId = Guid.NewGuid(), Version = (await staff.Parishes.GetAsync(staff.Parish, default))!.Version,
            AccountId = Guid.Parse(importer), Allows = [Permissions.PeopleRead, Permissions.PeopleWrite, Permissions.ImportsManage], StartsAt = f.Clock.Now
        }, default);
        var imports = f.Services.GetRequiredService<PeopleImportService>();
        var people = f.Services.GetRequiredService<PeopleService>();
        f.As(importer);
        await people.CreateAsync(staff.Parish, new CreatePersonDto { OperationId = Guid.NewGuid(), GivenName = "Existing", FamilyName = "Person", BirthDate = new DateOnly(1960, 6, 6) }, default);

        var staged = await imports.StageAsync(staff.Parish, Stage(Csv, null), default);
        Assert.Equal((2, 2, 1), (staged.Counts["Valid"], staged.Counts["Error"], staged.Counts["PossibleDuplicate"]));
        Assert.Equal(new DateOnly(1975, 12, 25), staged.Rows.Single(r => r.SourceId == "R2").BirthDate);
        Assert.Equal("Marie, Rose", staged.Rows.Single(r => r.SourceId == "R2").GivenName);
        Assert.Contains("date order", Assert.Single(staged.Rows.Single(r => r.SourceId == "R3").Problems), StringComparison.Ordinal);
        Assert.Single((await people.ListAsync(staff.Parish, 50, null, default)).Items);
        Assert.Equal("invalid_import_state", (await Assert.ThrowsAsync<DomainException>(() => imports.CommitAsync(staff.Parish, staged.Id,
            new CommitPeopleImportDto { OperationId = Guid.NewGuid(), Version = staged.Version }, default))).Code);

        var ordered = await imports.StageAsync(staff.Parish, Stage(Csv, "DMY"), default);
        Assert.Equal(new DateOnly(1990, 4, 3), ordered.Rows.Single(r => r.SourceId == "R3").BirthDate);
        var committed = await imports.CommitAsync(staff.Parish, ordered.Id, new CommitPeopleImportDto { OperationId = Guid.NewGuid(), Version = ordered.Version, ValidRowsOnly = true }, default);
        Assert.Equal(("Committed", 3), (committed.Status, committed.Counts["Imported"]));
        Assert.Equal(4, (await people.ListAsync(staff.Parish, 50, null, default)).Items.Count);

        var again = await imports.StageAsync(staff.Parish, Stage(Csv, "DMY"), default);
        Assert.Equal(3, again.Counts["Duplicate"]);
    }

    private static StagePeopleImportDto Stage(string csv, string? order) => new()
    {
        OperationId = Guid.NewGuid(), SourceName = "Isolated legacy register", SourceOwner = "Isolated office", SourceDate = new DateOnly(2026, 11, 1), DateOrder = order, Csv = csv
    };
}
