// Purpose: verifies optional person facts, medical declarations and consents (P02) through real local services and storage.
// Main tests: locality/skills/deceased precision rules with versions; medical data only for designated staff and labelled unverified
// without a source; paper versus digital consents with exact directory fields, own consents and recorded withdrawal.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.People;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class PersonFactsTests
{
    [Fact]
    public async Task Facts_medical_declarations_and_consents_keep_precision_purpose_and_source()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var office = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        var medicAccount = await f.CreateVerifiedStaffAsync();
        var medic = await staff.AcceptAsync(await staff.InviteAsync(medicAccount, allows: [Permissions.PeopleMedicalManage]));
        var service = f.Services.GetRequiredService<PersonFactsService>();
        f.AsAppointment(f.Other, office.Id);
        var person = (await f.Services.GetRequiredService<PeopleService>().CreateAsync(staff.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Member", BirthDate = new DateOnly(1950, 1, 1)
        }, default)).Id;

        var saved = await service.SaveFactsAsync(staff.Parish, person, new SavePersonFactsDto
        {
            OperationId = Guid.NewGuid(), Country = "Lebanon", Town = "Isolated town", Skills = ["Choir", "choir", "Carpentry"], PreferredLanguage = "ar"
        }, default);
        Assert.Equal(("Listed", 2, false), (saved.LocalityStatus, saved.Skills.Length, saved.Deceased));
        Assert.Equal("version_required", (await Assert.ThrowsAsync<DomainException>(() => service.SaveFactsAsync(staff.Parish, person,
            new SavePersonFactsDto { OperationId = Guid.NewGuid(), LocalityNotListed = "Village abroad" }, default))).Code);
        var version = (await service.GetFactsAsync(staff.Parish, person, default)).Version;
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => service.SaveFactsAsync(staff.Parish, person, new SavePersonFactsDto
        {
            OperationId = Guid.NewGuid(), Version = version, DeceasedPrecision = "Exact", DeceasedOn = "2999-01-01", DeceasedEvidence = "Isolated certificate"
        }, default))).Code);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => service.SaveFactsAsync(staff.Parish, person, new SavePersonFactsDto
        {
            OperationId = Guid.NewGuid(), Version = version, DeceasedPrecision = "Year", DeceasedOn = "2020"
        }, default))).Code);
        var deceased = await service.SaveFactsAsync(staff.Parish, person, new SavePersonFactsDto
        {
            OperationId = Guid.NewGuid(), Version = version, LocalityNotListed = "Village abroad", DeceasedPrecision = "Year", DeceasedOn = "2020",
            DeceasedEvidence = "Isolated parish death notice"
        }, default);
        Assert.Equal(("PendingReview", true, "2020"), (deceased.LocalityStatus, deceased.Deceased, deceased.DeceasedOn));
        await Assert.ThrowsAsync<DomainException>(() => service.SaveMedicalAsync(staff.Parish, person, new SaveMedicalDto
        {
            OperationId = Guid.NewGuid(), Allergies = "Peanuts", Purpose = "Isolated camp"
        }, default));

        f.AsAppointment(medicAccount, medic.Id);
        var medical = await service.SaveMedicalAsync(staff.Parish, person, new SaveMedicalDto
        {
            OperationId = Guid.NewGuid(), Allergies = "Peanuts", BloodType = "O+", Purpose = "Isolated camp safety"
        }, default);
        Assert.False(medical.Verified);
        Assert.Equal("Peanuts", (await service.GetMedicalAsync(staff.Parish, person, default)).Value.Allergies);
        await Assert.ThrowsAsync<DomainException>(() => service.GetFactsAsync(staff.Parish, person, default));

        f.AsAppointment(f.Other, office.Id);
        await Assert.ThrowsAsync<DomainException>(() => service.GetMedicalAsync(staff.Parish, person, default));
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => service.RecordConsentAsync(staff.Parish, person, Consent("Directory", [], "Mother"), default))).Code);
        var paper = await service.RecordConsentAsync(staff.Parish, person, Consent("Directory", ["Name", "Phone"], "Mother (guardian form)"), default);
        Assert.Equal(("PaperReceived", "Mother (guardian form)"), (paper.Source, paper.GivenBy));
        var member = await f.CreateVerifiedMemberAsync();
        await f.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(staff.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(member), PersonId = Guid.Parse(person), EvidenceReference = "Isolated reviewed identity"
        }, default);

        f.As(member);
        Assert.Equal("invalid_person_state", (await Assert.ThrowsAsync<DomainException>(() => service.RecordOwnConsentAsync(staff.Parish, Consent("Representation", [], null), default))).Code);
        var photo = await service.RecordOwnConsentAsync(staff.Parish, Consent("Photo", [], null), default);
        Assert.Equal(("Digital", "Self"), (photo.Source, photo.GivenBy));
        var rows = await service.OwnConsentsAsync(staff.Parish, default);
        Assert.Equal(2, rows.Count);
        var withdraw = new WithdrawConsentDto { OperationId = Guid.NewGuid(), Version = rows.Single(r => r.Value.Id == photo.Id).Version, Reason = "Changed my mind" };
        Assert.Equal("Withdrawn", (await service.WithdrawOwnConsentAsync(staff.Parish, photo.Id, withdraw, default)).Status);
        Assert.Equal("invalid_person_state", (await Assert.ThrowsAsync<DomainException>(() => service.WithdrawOwnConsentAsync(staff.Parish, photo.Id,
            new WithdrawConsentDto { OperationId = Guid.NewGuid(), Version = "any" }, default))).Code);
        Assert.Contains(await service.OwnConsentsAsync(staff.Parish, default), r => r.Value.Id == photo.Id && r.Value.WithdrawalReason == "Changed my mind");
    }

    [Fact]
    public async Task Members_see_their_data_and_closure_removes_only_optional_data_after_review()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var office = await staff.AcceptAsync(await staff.InviteAsync(f.Other, allows: [Permissions.PeopleRead, Permissions.PeopleWrite]));
        var facts = f.Services.GetRequiredService<PersonFactsService>();
        var data = f.Services.GetRequiredService<PersonDataService>();
        var people = f.Services.GetRequiredService<PeopleService>();
        f.AsAppointment(f.Other, office.Id);
        var person = (await people.CreateAsync(staff.Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(), GivenName = "Isolated", FamilyName = "Closer", Contact = "closer@fixture.example"
        }, default)).Id;
        await facts.SaveFactsAsync(staff.Parish, person, new SavePersonFactsDto { OperationId = Guid.NewGuid(), Occupation = "Teacher" }, default);
        await facts.RecordConsentAsync(staff.Parish, person, Consent("Photo", [], "Self (paper form)"), default);
        var member = await f.CreateVerifiedMemberAsync();
        await f.Services.GetRequiredService<MinistryPersonLinkService>().LinkAsync(staff.Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(member), PersonId = Guid.Parse(person), EvidenceReference = "Isolated reviewed identity"
        }, default);

        f.As(member);
        var mine = await data.OwnDataAsync(staff.Parish, default);
        Assert.Equal(("Closer", "Teacher", 1), (mine.FamilyName, mine.Facts!.Occupation, mine.Consents.Length));
        var request = await data.RequestAsync(staff.Parish, new DataClosureRequestDto { OperationId = Guid.NewGuid(), Details = "Please close my data" }, default);
        Assert.Equal("invalid_data_request_state", (await Assert.ThrowsAsync<DomainException>(() =>
            data.RequestAsync(staff.Parish, new DataClosureRequestDto { OperationId = Guid.NewGuid() }, default))).Code);

        f.AsAppointment(f.Other, office.Id);
        var preview = await data.PreviewAsync(staff.Parish, request.Id, default);
        Assert.Contains("medical declarations", preview.Removed);
        var queued = Assert.Single(await data.QueueAsync(staff.Parish, default));
        var done = await data.DecideAsync(staff.Parish, request.Id, new DataClosureDecisionDto { OperationId = Guid.NewGuid(), Version = queued.Version, Approve = true, Reason = "Identity confirmed in person" }, default);
        Assert.Equal("Completed", done.Status);
        Assert.Contains("Account link ended.", done.Outcome);
        var stored = (await people.GetAsync(staff.Parish, person, default)).Value;
        Assert.Equal(((string?)null, true, "Closer"), (stored.Contact, stored.Archived, stored.FamilyName));
        Assert.Null((await facts.GetFactsAsync(staff.Parish, person, default)).Value.Occupation);
        Assert.Equal("Withdrawn", Assert.Single(await facts.ConsentsAsync(staff.Parish, person, default)).Value.Status);

        f.As(member);
        await Assert.ThrowsAsync<DomainException>(() => data.OwnDataAsync(staff.Parish, default));
        Assert.Equal("Completed", Assert.Single(await data.OwnRequestsAsync(staff.Parish, default)).Status);
    }

    private static RecordConsentDto Consent(string kind, string[] fields, string? givenBy) => new()
    {
        OperationId = Guid.NewGuid(), Kind = kind, Purpose = "Isolated parish purpose", PolicyVersion = "2026-11", Fields = fields, GivenBy = givenBy
    };
}
