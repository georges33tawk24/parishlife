// Purpose: issues single-use, seven-day person invitations from the office and lets the intended recipient's own verified account claim
// the person link; conflicting claims stop for office review instead of linking.
// Main functions: CreateAsync, PreviewAsync, AcceptAsync, RevokeAsync and ListAsync.

using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Identity;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.People;

public class PersonInvitationService(IRecordTransactions records, IParishAccess access, MinistryAccess own, ICurrentActor actor, MfaAccountAccess proof,
    UserManager<ParishUser> users, NotificationService notifications, TimeProvider clock)
{
    private const string Purpose = "Link your account to your parish member record. It grants no ministry membership or staff authority.";
    private static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static DomainException Missing() => new("resource_not_found", "The requested invitation is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_invitation_state", message, FailureKind.Conflict);

    private async Task<Versioned<Parish>> OfficeAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, Permissions.PeopleWrite, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        return root;
    }

    public async Task<PersonInvitationIssuedDto> CreateAsync(string parish, string person, CreatePersonInvitationDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-invitation:v1:" + person);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            throw State("This invitation was already issued; issue a new one to get another link.");
        var target = await records.ReadAsync<Person>(Scope(parish), "person:" + person, ct);
        if (target?.Value is not { Archived: false } p || p.ParishId != parish)
            throw Missing();
        if ((await records.ReadAsync<CommandResult>(Scope(parish), "personAccountClaim:" + person, ct))?.Value.Status == "Linked")
            throw State("This person is already linked to an account.");
        // A replacement keeps the same target person and makes every earlier open link unusable.
        var changes = new List<RecordChange> { RecordChange.Replace("parish", "parish", root.Value, root.Version) };
        foreach (var old in await records.CollectAsync<PersonInvitation>(Scope(parish), "personInvitation", ct, 50,
            new RecordCondition { Path = "personId", Comparison = "eq", Value = person }))
            if (old.Value.Status == "Open")
            {
                old.Value.Status = "Revoked";
                changes.Add(RecordChange.Replace("personInvitation:" + old.Value.Id, "personInvitation", old.Value, old.Version));
            }
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var item = new PersonInvitation
        {
            Id = op.Id, ParishId = parish, PersonId = person, TokenHash = Hash(token), CreatedBy = actor.AccountId, CreatedAt = op.At, ExpiresAt = op.At + Lifetime
        };
        changes.Add(RecordChange.Create("personInvitation:" + item.Id, "personInvitation", item));
        await records.CommitAsync(Scope(parish), op, "person.invite", item.Id, changes, new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return new PersonInvitationIssuedDto { Id = item.Id, PersonId = person, ExpiresAt = item.ExpiresAt, Delivery = item.Delivery, Token = token };
    }

    public async Task<PersonInvitationPreviewDto> PreviewAsync(string parish, string id, string? token, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var root = await own.RootAsync(parish, ct);
        var item = (await TokenAsync(parish, id, token, ct)).Value;
        var status = Effective(item);
        var preview = new PersonInvitationPreviewDto { Status = status, Purpose = Purpose, ExpiresAt = item.ExpiresAt };
        if (status != "Open")
            return preview;
        var person = (await records.ReadAsync<Person>(Scope(parish), "person:" + item.PersonId, ct))?.Value ?? throw Missing();
        preview.ParishName = root.Value.Name;
        preview.PersonName = person.GivenName + " " + person.FamilyName;
        return preview;
    }

    public async Task<PersonInvitationDto> AcceptAsync(string parish, string id, string? token, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var root = await own.RootAsync(parish, ct);
        var row = await TokenAsync(parish, id, token, ct);
        var item = row.Value;
        var linkKey = "personAccountLink:" + actor.AccountId;
        var link = await records.ReadAsync<PersonAccountLink>(Scope(parish), linkKey, ct);
        // Retrying a successful claim resolves to the account's actual association instead of failing or duplicating it.
        if (item.Status == "Used" && item.UsedByAccountId == actor.AccountId && link?.Value is { Active: true } done && done.PersonId == item.PersonId)
            return Project(item);
        if (Effective(item) != "Open")
            throw State(Effective(item) == "Expired" ? "This invitation has expired; ask the parish office for a new one." : "This invitation can no longer be used.");
        var user = await users.FindByIdAsync(actor.AccountId);
        if (user is not { Active: true } || !AccountVerification.IsVerified(user))
            throw State("Verify your account's contact details before accepting.");
        var person = await records.ReadAsync<Person>(Scope(parish), "person:" + item.PersonId, ct);
        if (person?.Value is not { Archived: false } p || p.ParishId != parish)
            throw Missing();
        var claimKey = "personAccountClaim:" + item.PersonId;
        var claim = await records.ReadAsync<CommandResult>(Scope(parish), claimKey, ct);
        var op = Operation.Create(Guid.NewGuid(), actor.AccountId, new { id }, clock, "person-invitation-accept:v1:" + id);
        item.UsedByAccountId = actor.AccountId;
        item.UsedAt = op.At;
        var changes = new List<RecordChange> { RecordChange.Replace("parish", "parish", root.Value, root.Version) };
        var conflict = link is not null && (link.Value.PersonId != item.PersonId || !link.Value.Active) || claim is not null && claim.Value.Id != actor.AccountId;
        if (conflict)
        {
            // Nothing about the other record is revealed; the office reviews the mismatch.
            item.Status = "NeedsReview";
            item.ReviewReason = "The account or the person is already linked elsewhere.";
        }
        else
        {
            item.Status = "Used";
            if (link is null)
                changes.Add(RecordChange.Create(linkKey, "personAccountLink", new PersonAccountLink
                {
                    Id = actor.AccountId, ParishId = parish, PersonId = item.PersonId, AccountId = actor.AccountId, VerifiedBy = item.CreatedBy, VerifiedAt = op.At,
                    EvidenceReference = "Office person invitation " + item.Id, Active = true
                }));
            changes.Add(claim is null
                ? RecordChange.Create(claimKey, "personAccountClaim", new CommandResult { Id = actor.AccountId, Status = "Linked" })
                : RecordChange.Replace(claimKey, "personAccountClaim", claim.Value, claim.Version));
            changes.Add(RecordChange.Replace("person:" + item.PersonId, "person", person.Value, person.Version));
        }
        changes.Add(RecordChange.Replace("personInvitation:" + id, "personInvitation", item, row.Version));
        await records.CommitAsync(Scope(parish), op, conflict ? "person.invitation_conflict" : "person.invitation_accept", id, changes,
            new CommandResult { Id = id, Status = item.Status }, ct);
        if (conflict)
            await notifications.NotifyAsync(item.CreatedBy, parish, "person.invitation", "A person invitation needs office review.",
                "/api/parishes/" + parish + "/person-invitations", required: true, "person-invitation:" + id, ct);
        return Project(item);
    }

    public async Task<PersonInvitationDto> RevokeAsync(string parish, string id, RevokePersonInvitationDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-invitation-revoke:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)).Value);
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.Status is not ("Open" or "NeedsReview"))
            throw State("Only an open invitation or one waiting for review can be revoked.");
        item.Status = "Revoked";
        await records.CommitAsync(Scope(parish), op, "person.invitation_revoke", id,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Replace("personInvitation:" + id, "personInvitation", item, Versions.Require(request.Version))],
            new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<IReadOnlyList<Versioned<PersonInvitationDto>>> ListAsync(string parish, string? person, CancellationToken ct)
    {
        await OfficeAsync(parish, ct);
        var conditions = person is null ? [] : new[] { new RecordCondition { Path = "personId", Comparison = "eq", Value = person } };
        return (await records.CollectAsync<PersonInvitation>(Scope(parish), "personInvitation", ct, 2000, conditions))
            .OrderByDescending(r => r.Value.CreatedAt).Select(r => new Versioned<PersonInvitationDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    private async Task<Versioned<PersonInvitation>> ReadAsync(string parish, string id, CancellationToken ct)
        => await records.ReadAsync<PersonInvitation>(Scope(parish), "personInvitation:" + id, ct) is { } row && row.Value.ParishId == parish ? row : throw Missing();

    private async Task<Versioned<PersonInvitation>> TokenAsync(string parish, string id, string? token, CancellationToken ct)
    {
        var row = await ReadAsync(parish, id, ct);
        if (string.IsNullOrWhiteSpace(token) || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(row.Value.TokenHash), Encoding.ASCII.GetBytes(Hash(token))))
            throw Missing();
        return row;
    }

    private string Effective(PersonInvitation x) => x.Status == "Open" && clock.GetUtcNow() >= x.ExpiresAt ? "Expired" : x.Status;

    private PersonInvitationDto Project(PersonInvitation x) => new()
    {
        Id = x.Id, PersonId = x.PersonId, Status = Effective(x), Delivery = x.Delivery, CreatedAt = x.CreatedAt, ExpiresAt = x.ExpiresAt,
        UsedByAccountId = x.UsedByAccountId, UsedAt = x.UsedAt, ReviewReason = x.ReviewReason
    };

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
