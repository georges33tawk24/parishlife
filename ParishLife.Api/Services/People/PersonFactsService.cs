// Purpose: keeps optional person facts (structured locality, occupation/skills, language, deceased status), purpose-limited medical
// declarations protected at rest for designated staff only, and separate consents with source, giver and recorded withdrawal.
// Main functions: SaveFactsAsync, GetFactsAsync, ListFactsAsync (parish-wide page for lists), SaveMedicalAsync, GetMedicalAsync, RecordConsentAsync, RecordOwnConsentAsync,
// WithdrawConsentAsync, WithdrawOwnConsentAsync, ConsentsAsync, ParishConsentsAsync (parish-wide, e.g. the printed directory) and OwnConsentsAsync.

using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.People;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.People;

public class PersonFactsService(IRecordTransactions records, IParishAccess access, MinistryAccess own, ICurrentActor actor, MfaAccountAccess proof,
    IDataProtectionProvider protection, TimeProvider clock)
{
    private static readonly string[] Kinds = ["Directory", "Photo", "Communications", "Event", "Representation"];
    private static readonly string[] DirectoryFields = ["Name", "Phone", "Email", "Address", "Photo", "Household"];
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static DomainException Missing() => new("resource_not_found", "The requested person information is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_person_state", message, FailureKind.Conflict);
    private static string? Optional(string? value, string name, int max) => string.IsNullOrWhiteSpace(value) ? null : Guard.Text(value, name, max);
    private IDataProtector Protector(string parish, string person) => protection.CreateProtector("ParishLife.PersonMedical.v1", parish, person);

    private async Task<Versioned<Parish>> OfficeAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "office", ct);
        return root;
    }

    private async Task<Versioned<Person>> PersonAsync(string parish, string person, CancellationToken ct)
        => await records.ReadAsync<Person>(Scope(parish), "person:" + person, ct) is { } row && row.Value.ParishId == parish ? row : throw Missing();

    public async Task<PersonFactsDto> SaveFactsAsync(string parish, string person, SavePersonFactsDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, Permissions.PeopleWrite, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-facts:v1:" + person);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await records.ReadAsync<PersonFacts>(Scope(parish), "personFacts:" + person, ct))!.Value);
        await PersonAsync(parish, person, ct);
        var old = await records.ReadAsync<PersonFacts>(Scope(parish), "personFacts:" + person, ct);
        var skills = request.Skills.Select(s => Guard.Text(s, "Skill", 80)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        // Partial dates keep their precision; nothing invents a day or month.
        var precision = request.DeceasedPrecision;
        string? on = null;
        if (precision is "Exact")
            on = DateOnly.TryParseExact(request.DeceasedOn, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d) && d <= DateOnly.FromDateTime(op.At.UtcDateTime)
                ? request.DeceasedOn : throw new DomainException("invalid_input", "Give an exact date of death as yyyy-MM-dd, not in the future.");
        else if (precision is "Year")
            on = int.TryParse(request.DeceasedOn, NumberStyles.None, CultureInfo.InvariantCulture, out var y) && request.DeceasedOn!.Length == 4 && y <= op.At.Year
                ? request.DeceasedOn : throw new DomainException("invalid_input", "Give the year of death as yyyy.");
        else if (request.DeceasedOn is not null)
            throw new DomainException("invalid_input", "Choose Exact or Year precision for a date of death.");
        var evidence = precision is null ? null : Guard.Text(request.DeceasedEvidence, "Evidence of death", 500);
        var item = new PersonFacts
        {
            PersonId = person, ParishId = parish, Country = Optional(request.Country, "Country", 100), Region = Optional(request.Region, "Region", 100),
            District = Optional(request.District, "District", 100), Town = Optional(request.Town, "Town", 100), TownAr = Optional(request.TownAr, "Arabic town", 100),
            AddressDetail = Optional(request.AddressDetail, "Address detail", 300), LocalityNotListed = Optional(request.LocalityNotListed, "Locality not listed", 300),
            Occupation = Optional(request.Occupation, "Occupation", 200), Skills = skills, PreferredLanguage = request.PreferredLanguage,
            DeceasedOn = on, DeceasedPrecision = precision, DeceasedEvidence = evidence, UpdatedBy = actor.AccountId, UpdatedAt = op.At
        };
        if (item.LocalityNotListed is not null && (item.Town is not null || item.TownAr is not null))
            throw new DomainException("invalid_input", "Choose a listed town or describe the locality that is not listed, not both.");
        await records.CommitAsync(Scope(parish), op, "person.facts", person,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), old is null
                ? RecordChange.Create("personFacts:" + person, "personFacts", item)
                : RecordChange.Replace("personFacts:" + person, "personFacts", item, Versions.Require(request.Version))],
            new CommandResult { Id = person, Status = "Saved" }, ct);
        return Project(item);
    }

    public async Task<Versioned<PersonFactsDto>> GetFactsAsync(string parish, string person, CancellationToken ct)
    {
        await OfficeAsync(parish, Permissions.PeopleRead, ct);
        await PersonAsync(parish, person, ct);
        var row = await records.ReadAsync<PersonFacts>(Scope(parish), "personFacts:" + person, ct);
        return row is null
            ? new Versioned<PersonFactsDto> { Version = "", Value = Project(new PersonFacts { PersonId = person, ParishId = parish }) }
            : new Versioned<PersonFactsDto> { Version = row.Version, Value = Project(row.Value) };
    }

    // Every stored facts record of the parish, one page at a time, so lists can show town without reading each person.
    // Same office, permission and authenticator rules as reading one person's facts.
    public async Task<Page<Versioned<PersonFactsDto>>> ListFactsAsync(string parish, int size, string? cursor, CancellationToken ct)
    {
        await OfficeAsync(parish, Permissions.PeopleRead, ct);
        var page = await records.PageAsync<PersonFacts>(Scope(parish), "personFacts", size, cursor, ct);
        return new Page<Versioned<PersonFactsDto>>
        {
            Items = page.Items.Where(r => r.Value.ParishId == parish).Select(r => new Versioned<PersonFactsDto> { Version = r.Version, Value = Project(r.Value) }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<MedicalDto> SaveMedicalAsync(string parish, string person, SaveMedicalDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, Permissions.PeopleMedicalManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-medical:v1:" + person);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await records.ReadAsync<PersonMedical>(Scope(parish), "personMedical:" + person, ct))!.Value);
        await PersonAsync(parish, person, ct);
        var old = await records.ReadAsync<PersonMedical>(Scope(parish), "personMedical:" + person, ct);
        var content = new PersonMedicalContent
        {
            Allergies = Optional(request.Allergies, "Allergies", 1000), Conditions = Optional(request.Conditions, "Conditions", 1000),
            BloodType = request.BloodType, Notes = Optional(request.Notes, "Notes", 2000)
        };
        var item = new PersonMedical
        {
            PersonId = person, ParishId = parish, Source = Optional(request.Source, "Source", 300), Purpose = Guard.Text(request.Purpose, "Purpose", 300),
            UpdatedBy = actor.AccountId, UpdatedAt = op.At, ProtectedContent = Protector(parish, person).Protect(JsonSerializer.Serialize(content))
        };
        await records.CommitAsync(Scope(parish), op, "person.medical", person,
            [RecordChange.Replace("parish", "parish", root.Value, root.Version), old is null
                ? RecordChange.Create("personMedical:" + person, "personMedical", item)
                : RecordChange.Replace("personMedical:" + person, "personMedical", item, Versions.Require(request.Version))],
            new CommandResult { Id = person, Status = "Saved" }, ct);
        return Project(item);
    }

    public async Task<Versioned<MedicalDto>> GetMedicalAsync(string parish, string person, CancellationToken ct)
    {
        await OfficeAsync(parish, Permissions.PeopleMedicalManage, ct);
        var row = await records.ReadAsync<PersonMedical>(Scope(parish), "personMedical:" + person, ct) ?? throw Missing();
        return new Versioned<MedicalDto> { Version = row.Version, Value = Project(row.Value) };
    }

    // Office entry of a paper form: recorded as PaperReceived with who gave it, never as a digital acceptance.
    public async Task<ConsentDto> RecordConsentAsync(string parish, string person, RecordConsentDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, Permissions.PeopleWrite, ct);
        await PersonAsync(parish, person, ct);
        return await AddConsentAsync(parish, person, request, "PaperReceived", Guard.Text(request.GivenBy, "Given by", 200), root, ct);
    }

    public async Task<ConsentDto> RecordOwnConsentAsync(string parish, RecordConsentDto request, CancellationToken ct)
    {
        var link = await own.OwnLinkAsync(parish, ct);
        if (request.Kind == "Representation")
            throw State("Representation needs office review of its evidence.");
        return await AddConsentAsync(parish, link.Value.PersonId, request, "Digital", "Self", null, ct);
    }

    public async Task<ConsentDto> WithdrawConsentAsync(string parish, string id, WithdrawConsentDto request, CancellationToken ct)
    {
        var root = await OfficeAsync(parish, Permissions.PeopleWrite, ct);
        return await WithdrawAsync(parish, id, null, request, root, ct);
    }

    public async Task<ConsentDto> WithdrawOwnConsentAsync(string parish, string id, WithdrawConsentDto request, CancellationToken ct)
    {
        var link = await own.OwnLinkAsync(parish, ct);
        return await WithdrawAsync(parish, id, link.Value.PersonId, request, null, ct);
    }

    public async Task<IReadOnlyList<Versioned<ConsentDto>>> ConsentsAsync(string parish, string person, CancellationToken ct)
    {
        await OfficeAsync(parish, Permissions.PeopleRead, ct);
        return await ConsentRowsAsync(parish, person, ct);
    }

    // Parish-wide consents of one kind (for example every Directory consent for the printed directory); withdrawn ones are
    // included only when asked for, and each row keeps its exact fields, source and giver.
    public async Task<Page<Versioned<ConsentDto>>> ParishConsentsAsync(string parish, string kind, bool includeWithdrawn, int size, string? cursor, CancellationToken ct)
    {
        await OfficeAsync(parish, Permissions.PeopleRead, ct);
        if (!Kinds.Contains(kind))
            throw new DomainException("invalid_input", "Choose a consent kind: " + string.Join(", ", Kinds) + ".");
        var conditions = new List<RecordCondition> { new() { Path = "kind", Comparison = "eq", Value = kind } };
        if (!includeWithdrawn)
            conditions.Add(new RecordCondition { Path = "status", Comparison = "eq", Value = "Given" });
        var page = await records.PageAsync<PersonConsent>(Scope(parish), "personConsent", size, cursor, ct, [.. conditions]);
        return new Page<Versioned<ConsentDto>>
        {
            Items = page.Items.Where(r => r.Value.ParishId == parish).Select(r => new Versioned<ConsentDto> { Version = r.Version, Value = Project(r.Value) }).ToArray(),
            ContinuationToken = page.ContinuationToken
        };
    }

    public async Task<IReadOnlyList<Versioned<ConsentDto>>> OwnConsentsAsync(string parish, CancellationToken ct)
        => await ConsentRowsAsync(parish, (await own.OwnLinkAsync(parish, ct)).Value.PersonId, ct);

    private async Task<ConsentDto> AddConsentAsync(string parish, string person, RecordConsentDto request, string source, string givenBy, Versioned<Parish>? root, CancellationToken ct)
    {
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-consent:v1:" + person);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await records.ReadAsync<PersonConsent>(Scope(parish), "personConsent:" + prior.Id, ct))!.Value);
        var fields = request.Fields.Distinct(StringComparer.Ordinal).ToArray();
        if (request.Kind == "Directory" ? fields.Length == 0 || fields.Any(f => !DirectoryFields.Contains(f)) : fields.Length > 0)
            throw new DomainException("invalid_input", "Directory consent names the exact fields it discloses (Name, Phone, Email, Address, Photo, Household); other consents name none.");
        var item = new PersonConsent
        {
            Id = op.Id, ParishId = parish, PersonId = person, Kind = request.Kind, Purpose = Guard.Text(request.Purpose, "Purpose", 300),
            PolicyVersion = Guard.Text(request.PolicyVersion, "Policy version", 40), Fields = fields, Source = source, GivenBy = givenBy,
            RecordedBy = actor.AccountId, GivenAt = op.At
        };
        var changes = new List<RecordChange> { RecordChange.Create("personConsent:" + item.Id, "personConsent", item) };
        if (root is not null) changes.Insert(0, RecordChange.Replace("parish", "parish", root.Value, root.Version));
        await records.CommitAsync(Scope(parish), op, "person.consent", item.Id, changes, new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    private async Task<ConsentDto> WithdrawAsync(string parish, string id, string? ownPerson, WithdrawConsentDto request, Versioned<Parish>? root, CancellationToken ct)
    {
        var op = actor.CreateOperation(request.OperationId, request, clock, "person-consent-withdraw:v1:" + id);
        var key = "personConsent:" + id;
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await records.ReadAsync<PersonConsent>(Scope(parish), key, ct))!.Value);
        var item = (await records.ReadAsync<PersonConsent>(Scope(parish), key, ct))?.Value;
        if (item is null || item.ParishId != parish || ownPerson is not null && item.PersonId != ownPerson)
            throw Missing();
        if (item.Status != "Given")
            throw State("This consent was already withdrawn.");
        item.Status = "Withdrawn";
        item.WithdrawnAt = op.At;
        item.WithdrawalReason = Optional(request.Reason, "Reason", 500);
        var changes = new List<RecordChange> { RecordChange.Replace(key, "personConsent", item, Versions.Require(request.Version)) };
        if (root is not null) changes.Insert(0, RecordChange.Replace("parish", "parish", root.Value, root.Version));
        await records.CommitAsync(Scope(parish), op, "person.consent_withdraw", id, changes, new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item);
    }

    private async Task<IReadOnlyList<Versioned<ConsentDto>>> ConsentRowsAsync(string parish, string person, CancellationToken ct)
        => (await records.CollectAsync<PersonConsent>(Scope(parish), "personConsent", ct, 500, new RecordCondition { Path = "personId", Comparison = "eq", Value = person }))
            .OrderByDescending(r => r.Value.GivenAt).Select(r => new Versioned<ConsentDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();

    internal static PersonFactsDto Project(PersonFacts x) => new()
    {
        PersonId = x.PersonId, Country = x.Country, Region = x.Region, District = x.District, Town = x.Town, TownAr = x.TownAr, AddressDetail = x.AddressDetail,
        LocalityNotListed = x.LocalityNotListed,
        LocalityStatus = x.LocalityNotListed is not null ? "PendingReview" : x.Town is not null || x.TownAr is not null ? "Listed" : "NotRecorded",
        Occupation = x.Occupation, Skills = x.Skills, PreferredLanguage = x.PreferredLanguage, Deceased = x.DeceasedPrecision is not null,
        DeceasedOn = x.DeceasedOn, DeceasedPrecision = x.DeceasedPrecision, DeceasedEvidence = x.DeceasedEvidence, UpdatedBy = x.UpdatedBy, UpdatedAt = x.UpdatedAt
    };

    private MedicalDto Project(PersonMedical x)
    {
        var content = JsonSerializer.Deserialize<PersonMedicalContent>(Protector(x.ParishId, x.PersonId).Unprotect(x.ProtectedContent)) ?? new PersonMedicalContent();
        return new MedicalDto
        {
            PersonId = x.PersonId, Allergies = content.Allergies, Conditions = content.Conditions, BloodType = content.BloodType, Notes = content.Notes,
            Source = x.Source, Verified = x.Source is not null, Purpose = x.Purpose, UpdatedBy = x.UpdatedBy, UpdatedAt = x.UpdatedAt
        };
    }

    internal static ConsentDto Project(PersonConsent x) => new()
    {
        Id = x.Id, PersonId = x.PersonId, Kind = x.Kind, Purpose = x.Purpose, PolicyVersion = x.PolicyVersion, Fields = x.Fields, Source = x.Source,
        GivenBy = x.GivenBy, GivenAt = x.GivenAt, Status = x.Status, WithdrawnAt = x.WithdrawnAt, WithdrawalReason = x.WithdrawalReason
    };
}
