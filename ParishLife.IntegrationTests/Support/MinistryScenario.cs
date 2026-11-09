// Purpose: prepares isolated ministry scope, evidenced priest capacity and linked applicants through real backend services.
// Main functions: CreateAsync establishes paid scope; Use selects the priest; MinistryAsync, ActAsync, LinkedApplicantAsync,
// ApplyAsync and ApplicationActionAsync exercise persisted workflows with current versions and explicit test identities.

using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Ministries;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Identity;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.People;

namespace ParishLife.IntegrationTests.Support;

internal class MinistryScenario(StaffAppointmentScenario staff, string appointment)
{
    internal StaffAppointmentScenario Staff { get; } = staff;
    internal LocalBackendFixture Fixture => Staff.Fixture;
    internal string Parish => Staff.Parish;
    internal string Appointment { get; } = appointment;
    internal MinistryService Ministries => Fixture.Services.GetRequiredService<MinistryService>();
    internal MinistryApplicationService Applications => Fixture.Services.GetRequiredService<MinistryApplicationService>();
    internal MinistryPersonLinkService Links => Fixture.Services.GetRequiredService<MinistryPersonLinkService>();

    internal static async Task<MinistryScenario> CreateAsync(LocalBackendFixture fixture, string[]? extraPriestDuties = null)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(fixture);
        await staff.ActivateOfficeAsync(["core", "office", "ministries"]);
        var priest = await staff.AcceptAsync(await staff.InviteAsync(fixture.Other,
            allows: new[] { Permissions.MinistriesManage, Permissions.PeopleWrite, Permissions.PeopleRead, Permissions.PublishingManage }
                .Concat(extraPriestDuties ?? []).Distinct(StringComparer.Ordinal).ToArray()));
        return new MinistryScenario(staff, priest.Id);
    }

    internal void Use() => Fixture.AsAppointment(Fixture.Other, Appointment);

    internal async Task<MinistryDto> MinistryAsync(bool open = true, bool publish = false)
    {
        Use();
        var ministry = await Ministries.SaveAsync(Parish, null, new SaveMinistryDto
        {
            OperationId = Guid.NewGuid(),
            Name = "Isolated ministry",
            Kind = "Ministry",
            Purpose = "Isolated ministry workflow verification",
            EligibilityPolicyReference = "isolated reviewed group policy"
        }, default);
        ministry = await ActAsync(ministry.Id, "approve");
        if (open) ministry = await ActAsync(ministry.Id, "open-applications");
        if (publish) ministry = await ActAsync(ministry.Id, "publish");
        return ministry;
    }

    internal async Task<MinistryDto> ActAsync(string ministry, string action)
    {
        Use();
        var row = await Ministries.GetAsync(Parish, ministry, default);
        return await Ministries.ActAsync(Parish, ministry, new MinistryActionDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            Action = action,
            Reason = "Isolated ministry decision"
        }, default);
    }

    internal async Task<(string AccountId, string PersonId, string Username)> LinkedApplicantAsync(bool mfa = false)
    {
        var account = mfa ? await Fixture.CreateVerifiedStaffAsync() : await Fixture.CreateVerifiedMemberAsync();
        Use();
        var person = await Fixture.Services.GetRequiredService<PeopleService>().CreateAsync(Parish, new CreatePersonDto
        {
            OperationId = Guid.NewGuid(),
            GivenName = "Isolated",
            FamilyName = "Applicant",
            BirthDate = new DateOnly(1990, 1, 1)
        }, default);
        await Links.LinkAsync(Parish, new LinkMinistryPersonDto
        {
            OperationId = Guid.NewGuid(),
            AccountId = Guid.Parse(account),
            PersonId = Guid.Parse(person.Id),
            EvidenceReference = "isolated reviewed person-account identity"
        }, default);
        var user = (await Fixture.Services.GetRequiredService<UserManager<ParishUser>>().FindByIdAsync(account))!;
        return (account, person.Id, user.UserName!);
    }

    internal async Task<MinistryApplicationDto> ApplyAsync(string ministry, string account, string kind = "Join")
    {
        Fixture.As(account, mfa: false);
        return await Applications.ApplyAsync(Parish, ministry,
            new ApplyMinistryDto { OperationId = Guid.NewGuid(), Kind = kind }, default);
    }

    internal async Task<MinistryApplicationDto> ApplicationActionAsync(string ministry, string application, string action)
    {
        Use();
        var row = await Applications.GetAsync(Parish, ministry, application, default);
        return await Applications.ActAsync(Parish, ministry, application, new ApplicationActionDto
        {
            OperationId = Guid.NewGuid(),
            Version = row.Version,
            Action = action,
            Reason = "Isolated applicant-visible decision",
            EligibilityReviewReference = action == "approve" ? "isolated reviewed eligibility and consent evidence" : null
        }, default);
    }
}
