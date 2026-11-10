// Purpose: verifies duplicate suggestions, reviewer decisions and reviewed merge/unmerge (P05) through real local services and storage.
// Main tests: a shared name alone never suggests a duplicate; "different" suppresses a pair; merges need a choice per differing field,
// keep the account-linked person, archive the other and can be undone while nothing changed afterwards.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class DuplicateTests
{
    [Fact]
    public async Task Suggestions_need_two_signals_and_merges_are_explicit_linked_safe_and_reversible()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var office = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        var duplicates = f.Services.GetRequiredService<DuplicateService>();
        var people = f.Services.GetRequiredService<PeopleService>();
        f.AsAppointment(f.Other, office.Id);
        async Task<string> Create(string given, string family, DateOnly? birth, string? contact)
            => (await people.CreateAsync(staff.Parish, new CreatePersonDto { OperationId = Guid.NewGuid(), GivenName = given, FamilyName = family, BirthDate = birth, Contact = contact }, default)).Id;
        var a = await Create("Élie", "Haddad", new DateOnly(1980, 1, 1), "a@fixture.example");
        var b = await Create("Elie", "Haddad", new DateOnly(1980, 1, 1), "b@fixture.example");
        await Create("Maria", "Haddad", new DateOnly(1990, 1, 1), null);
        await Create("John", "Smith", null, null);
        await Create("John", "Smith", null, null);
        var f1 = await Create("Rita", "Khoury", new DateOnly(1970, 5, 5), null);
        var f2 = await Create("Rita", "Khoury", new DateOnly(1970, 5, 5), null);

        var suggested = await duplicates.SuggestAsync(staff.Parish, default);
        Assert.Equal(2, suggested.Count);
        var pair = Assert.Single(suggested, s => s.NameA.EndsWith("Haddad", StringComparison.Ordinal));
        Assert.Equal(["Same family name", "Same given name", "Same birth date"], pair.Signals);
        Assert.Equal(["GivenName", "Contact"], pair.Differences);
        await duplicates.DecideAsync(staff.Parish, new DuplicateDecisionDto { OperationId = Guid.NewGuid(), PersonA = Guid.Parse(f1), PersonB = Guid.Parse(f2), Decision = "different", Reason = "Twins" }, default);
        Assert.DoesNotContain(await duplicates.SuggestAsync(staff.Parish, default), s => s.NameA.EndsWith("Khoury", StringComparison.Ordinal));

        var member = await f.CreateVerifiedMemberAsync();
        await f.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(staff.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(member), PersonId = Guid.Parse(b), EvidenceReference = "Isolated reviewed identity"
        }, default);
        var preview = await duplicates.PreviewMergeAsync(staff.Parish, a, b, default);
        Assert.Equal((true, false, false), (preview.SourceLinked, preview.SurvivorLinked, preview.NeedsPriest));
        Assert.Equal("invalid_merge_state", (await Assert.ThrowsAsync<DomainException>(() => MergeAsync(duplicates, staff.Parish, a, b, new()))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => MergeAsync(duplicates, staff.Parish, b, a, new() { ["GivenName"] = "source" }))).Code);
        var merge = await MergeAsync(duplicates, staff.Parish, b, a, new() { ["GivenName"] = "source", ["Contact"] = "survivor" });
        var survivor = (await people.GetAsync(staff.Parish, b, default)).Value;
        Assert.Equal(("Élie", "b@fixture.example"), (survivor.GivenName, survivor.Contact));
        Assert.True((await people.GetAsync(staff.Parish, a, default)).Value.Archived);
        Assert.DoesNotContain(await duplicates.SuggestAsync(staff.Parish, default), s => s.NameA.EndsWith("Haddad", StringComparison.Ordinal));

        var undone = await duplicates.UnmergeAsync(staff.Parish, merge.Id, new UnmergePeopleDto { OperationId = Guid.NewGuid(), Version = merge.Version, Reason = "Reviewed: different people" }, default);
        Assert.Equal("Unmerged", undone.Status);
        Assert.Equal(("Elie", false), ((await people.GetAsync(staff.Parish, b, default)).Value.GivenName, (await people.GetAsync(staff.Parish, a, default)).Value.Archived));
        Assert.Equal("invalid_merge_state", (await Assert.ThrowsAsync<DomainException>(() => duplicates.UnmergeAsync(staff.Parish, merge.Id,
            new UnmergePeopleDto { OperationId = Guid.NewGuid(), Version = undone.Version, Reason = "Again" }, default))).Code);
    }

    private static Task<PersonMergeDto> MergeAsync(DuplicateService duplicates, string parish, string survivor, string source, Dictionary<string, string> choices)
        => duplicates.MergeAsync(parish, new MergePeopleDto
        {
            OperationId = Guid.NewGuid(), SurvivorId = Guid.Parse(survivor), SourceId = Guid.Parse(source), Choices = choices, Reason = "Same person confirmed by the office"
        }, default);
}
