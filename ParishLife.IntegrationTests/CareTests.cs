// Purpose: verifies pastoral notes (S28) and confidential concerns (S27) through real local services and storage.
// Main tests: author-only notes widen only by explicit share, tasks never go to someone who cannot read them, and office staff or the
// bishop get no fallback; concerns need bishop-appointed reviewers, exclude implicated people, keep reviewer-only notes from submitters,
// respect anonymity and identity capability, and stop access when a reviewer appointment ends.

using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Care;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Care;
using ParishLife.Api.Services.Organizations;
using ParishLife.IntegrationTests.Support;
using Xunit;

namespace ParishLife.IntegrationTests;

public class CareTests
{
    private sealed record Setup(LocalBackendFixture F, StaffAppointmentScenario Staff, string SecondPriest, string ThirdPriest, Dictionary<string, string> Appointments)
    {
        // Priests act as priests only through their selected appointment, as everywhere else in the API.
        public void AsPriest(string account) => F.AsAppointment(account, Appointments[account]);

        public PastoralNoteService Notes => F.Services.GetRequiredService<PastoralNoteService>();
        public ConcernService Concerns => F.Services.GetRequiredService<ConcernService>();
        public string Parish => Staff.Parish;
    }

    [Fact]
    public async Task Pastoral_notes_stay_with_the_author_unless_explicitly_shared_and_have_no_admin_or_bishop_fallback()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        x.AsPriest(f.Other);
        var note = await x.Notes.SaveAsync(x.Parish, null, Note("Author", "Private reflection"), default);
        Assert.Equal("Private reflection", note.Body);
        foreach (var reader in new[] { x.SecondPriest, f.Nominee, f.FirstAdmin })
        {
            if (x.Appointments.ContainsKey(reader)) x.AsPriest(reader); else f.As(reader);
            await Assert.ThrowsAsync<DomainException>(() => x.Notes.GetAsync(x.Parish, note.Id, default));
            Assert.DoesNotContain((await x.Notes.ListAsync(x.Parish, default)), n => n.Value.Id == note.Id);
        }
        f.As(f.FirstAdmin);
        await Assert.ThrowsAsync<DomainException>(() => x.Notes.SaveAsync(x.Parish, null, Note("Author", "Not a priest"), default));

        x.AsPriest(f.Other);
        var shared = Note("NamedPriest", "Visit plan");
        shared.SharedWithAccountId = Guid.Parse(x.SecondPriest);
        shared.Kind = "Task";
        shared.AssigneeAccountId = Guid.Parse(x.ThirdPriest);
        Assert.Equal("invalid_input", (await Assert.ThrowsAsync<DomainException>(() => x.Notes.SaveAsync(x.Parish, null, shared, default))).Code);
        shared.OperationId = Guid.NewGuid();
        shared.AssigneeAccountId = Guid.Parse(x.SecondPriest);
        var task = await x.Notes.SaveAsync(x.Parish, null, shared, default);
        x.AsPriest(x.ThirdPriest);
        await Assert.ThrowsAsync<DomainException>(() => x.Notes.GetAsync(x.Parish, task.Id, default));
        x.AsPriest(x.SecondPriest);
        var read = await x.Notes.GetAsync(x.Parish, task.Id, default);
        Assert.Equal("Visit plan", read.Value.Body);
        var done = await x.Notes.ActAsync(x.Parish, task.Id, new PastoralNoteActionDto { OperationId = Guid.NewGuid(), Version = read.Version, Action = "complete" }, default);
        Assert.Equal(("Done", x.SecondPriest), (done.Status, done.CompletedBy));

        x.AsPriest(f.Other);
        var everyone = await x.Notes.SaveAsync(x.Parish, null, Note("ParishPriests", "Parish-wide pastoral context"), default);
        x.AsPriest(x.ThirdPriest);
        Assert.Equal("Parish-wide pastoral context", (await x.Notes.GetAsync(x.Parish, everyone.Id, default)).Value.Body);
        var stored = (await f.Services.GetRequiredService<IRecordTransactions>().ReadAsync<PastoralNote>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, "pastoralNote:" + note.Id, default))!;
        Assert.DoesNotContain("Private reflection", stored.Value.ProtectedContent);
    }

    [Fact]
    public async Task Concerns_reach_only_eligible_non_implicated_reviewers_and_reviewer_notes_never_reach_the_submitter()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var submitter = await f.CreateVerifiedMemberAsync();
        f.As(submitter, mfa: false);
        Assert.Equal("invalid_concern_state", (await Assert.ThrowsAsync<DomainException>(() => x.Concerns.SubmitAsync(x.Parish, Concern([]), default))).Code);

        var (first, firstAccount) = await AppointAsync(x, ["Safeguarding", "Other"], identity: true);
        var (_, secondAccount) = await AppointAsync(x, ["Safeguarding"], identity: false);
        f.As(submitter, mfa: false);
        Assert.Equal(2, (await x.Concerns.ReviewerOptionsAsync(x.Parish, default)).Count);
        var request = Concern([]);
        request.ImplicatedAccountIds = [Guid.Parse(secondAccount)];
        var concern = await x.Concerns.SubmitAsync(x.Parish, request, default);

        f.As(secondAccount);
        await Assert.ThrowsAsync<DomainException>(() => x.Concerns.GetAsync(x.Parish, concern.Id, default));
        Assert.Empty(await x.Concerns.AssignedAsync(x.Parish, default));
        foreach (var outsider in new[] { f.Other, f.Nominee, f.FirstAdmin })
        {
            if (x.Appointments.ContainsKey(outsider)) x.AsPriest(outsider); else f.As(outsider);
            await Assert.ThrowsAsync<DomainException>(() => x.Concerns.GetAsync(x.Parish, concern.Id, default));
        }

        f.As(firstAccount);
        var assigned = Assert.Single(await x.Concerns.AssignedAsync(x.Parish, default));
        Assert.Equal(submitter, assigned.Value.SubmitterAccountId);
        await ActAsync(x, concern.Id, "accept");
        await EntryAsync(x, concern.Id, "ReviewerNote", "Reviewer-only working note");
        await EntryAsync(x, concern.Id, "InformationRequest", "When did this happen?");
        Assert.Equal("NeedsInformation", (await x.Concerns.GetAsync(x.Parish, concern.Id, default)).Value.Status);

        f.As(submitter, mfa: false);
        await Assert.ThrowsAsync<DomainException>(() => EntryAsync(x, concern.Id, "ReviewerNote", "Not allowed"));
        await EntryAsync(x, concern.Id, "SubmitterMessage", "Last Sunday");
        var visible = await x.Concerns.EntriesAsync(x.Parish, concern.Id, default);
        Assert.Equal(["When did this happen?", "Last Sunday"], visible.Select(e => e.Body).Order(StringComparer.Ordinal).Reverse());
        Assert.DoesNotContain(visible, e => e.Kind == "ReviewerNote");

        f.As(firstAccount);
        Assert.Equal("UnderReview", (await x.Concerns.GetAsync(x.Parish, concern.Id, default)).Value.Status);
        await ActAsync(x, concern.Id, "respond");
        Assert.Equal("Closed", (await ActAsync(x, concern.Id, "close")).Status);
        f.As(submitter, mfa: false);
        Assert.Equal("Reopened", (await ActAsync(x, concern.Id, "reopen")).Status);
        Assert.Single(await x.Concerns.OwnAsync(x.Parish, default));
        Assert.Equal(first, (await x.Concerns.ReviewerOptionsAsync(x.Parish, default)).First(o => o.Categories.Contains("Other")).Id);
    }

    [Fact]
    public async Task Anonymity_and_identity_capability_are_respected_and_ended_reviewers_lose_access()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var x = await CreateAsync(f);
        var (identityReviewer, identityAccount) = await AppointAsync(x, ["Interpersonal"], identity: true);
        var (_, otherAccount) = await AppointAsync(x, ["Interpersonal"], identity: false);
        var submitter = await f.CreateVerifiedMemberAsync();
        f.As(submitter, mfa: false);
        var request = Concern([identityReviewer], "Interpersonal");
        request.Anonymous = true;
        var concern = await x.Concerns.SubmitAsync(x.Parish, request, default);
        f.As(otherAccount);
        await Assert.ThrowsAsync<DomainException>(() => x.Concerns.GetAsync(x.Parish, concern.Id, default));
        f.As(identityAccount);
        Assert.Null((await x.Concerns.GetAsync(x.Parish, concern.Id, default)).Value.SubmitterAccountId);
        f.As(submitter, mfa: false);
        await ActAsync(x, concern.Id, "identify");
        f.As(identityAccount);
        Assert.Equal(submitter, (await x.Concerns.GetAsync(x.Parish, concern.Id, default)).Value.SubmitterAccountId);

        f.As(f.Nominee);
        var row = (await f.Services.GetRequiredService<IRecordTransactions>().ReadAsync<ConcernReviewer>(
            new RecordScope { Area = RecordArea.Archdiocese, OwnerId = x.Staff.Organization }, "concernReviewer:" + identityReviewer, default))!;
        await x.Concerns.EndReviewerAsync(x.Staff.Organization, identityReviewer, new EndReviewerDto { OperationId = Guid.NewGuid(), Version = row.Version, Reason = "Term ended" }, default);
        f.As(identityAccount);
        await Assert.ThrowsAsync<DomainException>(() => x.Concerns.GetAsync(x.Parish, concern.Id, default));
    }

    private static async Task<Setup> CreateAsync(LocalBackendFixture f)
    {
        var staff = await StaffAppointmentScenario.CreateAsync(f);
        await staff.ActivateOfficeAsync(["core", "office"]);
        var appointments = new Dictionary<string, string> { [f.Other] = (await staff.AcceptAsync(await staff.InviteAsync(f.Other))).Id };
        var second = await f.CreateVerifiedStaffAsync();
        appointments[second] = (await staff.AcceptAsync(await staff.InviteAsync(second))).Id;
        var third = await f.CreateVerifiedStaffAsync();
        appointments[third] = (await staff.AcceptAsync(await staff.InviteAsync(third))).Id;
        return new Setup(f, staff, second, third, appointments);
    }

    private static SavePastoralNoteDto Note(string visibility, string body) => new()
    {
        OperationId = Guid.NewGuid(), Kind = "Note", Title = "Isolated note", Body = body, Visibility = visibility
    };

    private static async Task<(string Id, string Account)> AppointAsync(Setup x, string[] categories, bool identity)
    {
        var account = await x.F.CreateVerifiedStaffAsync();
        x.F.As(x.F.Nominee);
        var option = await x.Concerns.AppointReviewerAsync(x.Staff.Organization, new AppointReviewerDto
        {
            OperationId = Guid.NewGuid(), AccountId = Guid.Parse(account), Description = "Isolated independent reviewer", Categories = categories,
            CanViewIdentity = identity, EvidenceReference = "Isolated bishop decree"
        }, default);
        return (option.Id, account);
    }

    private static SubmitConcernDto Concern(string[] reviewers, string category = "Safeguarding") => new()
    {
        OperationId = Guid.NewGuid(), Category = category, Urgency = "Normal", Summary = "Isolated concern", Details = "Isolated details", ReviewerIds = reviewers
    };

    private static async Task<ConcernDto> ActAsync(Setup x, string id, string action)
    {
        var version = (await x.F.Services.GetRequiredService<IRecordTransactions>().ReadAsync<Concern>(new RecordScope { Area = RecordArea.Parish, OwnerId = x.Parish }, "concern:" + id, default))!.Version;
        return await x.Concerns.ActAsync(x.Parish, id, new ConcernActionDto { OperationId = Guid.NewGuid(), Version = version, Action = action }, default);
    }

    private static Task<ConcernEntryDto> EntryAsync(Setup x, string id, string kind, string body)
        => x.Concerns.PostEntryAsync(x.Parish, id, new PostConcernEntryDto { OperationId = Guid.NewGuid(), Kind = kind, Body = body }, default);
}
