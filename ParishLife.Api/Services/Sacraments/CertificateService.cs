// Purpose: runs certificates from a registered (or awaited) sacramental entry through preparation, priest signing, bishop acceptance where
// the bishop's policy requires it, issue, verified release, withdrawal and versioned reissue.
// Main functions: CreateAsync, ActAsync, GetAsync, ListAsync and SetPolicyAsync; helpers check office, priest, bishop and release authority,
// freeze the source snapshot at preparation and refuse issuing a snapshot the source has since amended.

using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Sacraments;

public class CertificateService(IRecordTransactions records, IParishAccess access, IParishRepository parishes, IClergyAuthority clergy,
    IArchdioceseAuthority bishops, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string id) => "certificate:" + id;
    private static DomainException Missing() => new("resource_not_found", "The requested certificate is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_certificate_state", message, FailureKind.Conflict);
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    private async Task<Versioned<Parish>> StaffAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "sacraments", ct);
        return root;
    }

    private async Task<string> ArchdioceseAsync(string parish, CancellationToken ct)
        => (await parishes.GetAsync(parish, ct))?.Value.JurisdictionArchdioceseId ?? throw State("This parish has no bishop jurisdiction for certificate review.");

    private async Task<bool> BishopReviewRequiredAsync(string parish, CancellationToken ct)
    {
        var archdiocese = await ArchdioceseAsync(parish, ct);
        // The bishop-acceptance stage stays the default until the bishop explicitly configures otherwise.
        return (await records.ReadAsync<CertificatePolicy>(new RecordScope { Area = RecordArea.Archdiocese, OwnerId = archdiocese }, "certificatePolicy", ct))?.Value
            .RequireBishopAcceptance ?? true;
    }

    public async Task<CertificatePolicyStateDto> SetPolicyAsync(string archdiocese, CertificatePolicyDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await bishops.RequireBishopAsync(archdiocese, ct);
        var scope = new RecordScope { Area = RecordArea.Archdiocese, OwnerId = archdiocese };
        var op = actor.CreateOperation(request.OperationId, request, clock, "certificate-policy:v1:" + archdiocese);
        var existing = await records.ReadAsync<CertificatePolicy>(scope, "certificatePolicy", ct);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is not null)
            return Project(existing!.Value);
        var policy = new CertificatePolicy { RequireBishopAcceptance = request.RequireBishopAcceptance, Reason = Guard.Text(request.Reason, "Reason", 2000), ApprovedBy = actor.AccountId, ApprovedAt = op.At };
        await records.CommitAsync(scope, op, "certificates.policy", archdiocese,
            [existing is null ? RecordChange.Create("certificatePolicy", "certificatePolicy", policy) : RecordChange.Replace("certificatePolicy", "certificatePolicy", policy, existing.Version)],
            new CommandResult { Id = archdiocese, Status = "Saved" }, ct);
        return Project(policy);
    }

    public async Task<CertificateDto> CreateAsync(string parish, CreateCertificateDto request, CancellationToken ct)
    {
        var root = await StaffAsync(parish, Permissions.SacramentsRecord, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "certificate:v1:" + parish);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync(parish, prior.Id, ct)).Value);
        var person = Guard.Id(request.SubjectPersonId);
        var item = new Certificate
        {
            Id = op.Id, ParishId = parish, Reference = "CERT-" + op.Id[..10].ToUpperInvariant(), Version = 1, PersonId = person, Kind = request.Sacrament,
            RequestId = request.RequestId is { } r ? Guard.Id(r) : null, Language = request.Language is "en" or "fr" or "ar" ? request.Language : throw new DomainException("invalid_input", "Use en, fr or ar."),
            Quantity = request.Quantity is >= 1 and <= 20 ? request.Quantity : throw new DomainException("invalid_input", "Request 1–20 copies."),
            Purpose = string.IsNullOrWhiteSpace(request.Purpose) ? null : Guard.Text(request.Purpose, "Purpose", 300), CreatedBy = actor.AccountId, CreatedAt = op.At
        };
        var changes = new List<RecordChange> { Fence(root) };
        if (request.ReplacesCertificateId is { } replaces)
        {
            // A replacement is a new version with its own reference and reason; it repeats every gate.
            var old = (await ReadAsync(parish, Guard.Id(replaces), ct)).Value;
            if (old.Status is not ("Issued" or "Released" or "Withdrawn") || old.PersonId != person)
                throw State("Only an issued certificate for the same person can be reissued.");
            item.ReplacesId = old.Id;
            item.Version = old.Version + 1;
            item.ReissueReason = Guard.Text(request.ReissueReason, "Reissue reason", 2000);
        }
        if (request.SourceRecordId is { } source)
            item.SourceRecordId = (await SourceAsync(parish, Guard.Id(source), item, ct)).Id;
        else
            item.Status = "WaitingForSource";
        changes.Add(RecordChange.Create(Key(item.Id), "certificate", item));
        await records.CommitAsync(Scope(parish), op, "certificates.create", item.Id, changes, new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<CertificateDto> ActAsync(string parish, string id, CertificateActionDto request, CancellationToken ct)
    {
        Versioned<Parish> root;
        switch (request.Action)
        {
            case "sign":
                await proof.RequireMfaAsync(ct);
                await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
                root = await parishes.GetAsync(parish, ct) ?? throw Missing();
                break;
            case "accept":
                await proof.RequireMfaAsync(ct);
                await bishops.RequireBishopAsync(await ArchdioceseAsync(parish, ct), ct);
                root = await parishes.GetAsync(parish, ct) ?? throw Missing();
                break;
            case "return":
                root = await DeciderAsync(parish, id, ct);
                break;
            case "issue" or "release" or "withdraw":
                root = await StaffAsync(parish, Permissions.DocumentsRelease, ct);
                break;
            default:
                root = await StaffAsync(parish, Permissions.SacramentsRecord, ct);
                break;
        }
        var op = actor.CreateOperation(request.OperationId, request, clock, "certificate-action:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)).Value);
        var item = (await ReadAsync(parish, id, ct)).Value;
        switch (request.Action)
        {
            case "link-source" when item.Status == "WaitingForSource":
                item.SourceRecordId = (await SourceAsync(parish, Guard.Id(request.SourceRecordId ?? throw new DomainException("invalid_input", "Choose the registered entry.")), item, ct)).Id;
                item.Status = "Received";
                break;
            case "prepare" when item.Status is "Received" or "Returned":
                var source = await SourceAsync(parish, item.SourceRecordId!, item, ct);
                item.Snapshot = SacramentService.Current(source);
                item.OfficialNumber = source.OfficialNumber;
                item.SourceAmendments = source.Amendments.Length;
                item.PreparedBy = actor.AccountId;
                item.ReturnReason = null;
                item.Status = "Prepared";
                break;
            case "submit" when item.Status == "Prepared":
                item.Status = "AwaitingSignature";
                break;
            case "sign" when item.Status == "AwaitingSignature":
                // Records that the priest approved and signed the paper; no electronic signature is claimed.
                item.SignedBy = actor.AccountId;
                item.SignedAt = op.At;
                item.BishopReviewRequired = await BishopReviewRequiredAsync(parish, ct);
                item.Status = item.BishopReviewRequired ? "AwaitingBishop" : "AuthorizedForIssuance";
                break;
            case "accept" when item.Status == "AwaitingBishop":
                item.AcceptedBy = actor.AccountId;
                item.AcceptedAt = op.At;
                item.Status = "AuthorizedForIssuance";
                break;
            // An authorized certificate whose source entry was later corrected also returns for fresh preparation and signing.
            case "return" when item.Status is "AwaitingSignature" or "AwaitingBishop" or "AuthorizedForIssuance":
                item.ReturnReason = Guard.Text(request.Reason, "Return reason", 2000);
                item.SignedBy = null;
                item.SignedAt = null;
                item.AcceptedBy = null;
                item.AcceptedAt = null;
                item.Status = "Returned";
                break;
            case "issue" when item.Status == "AuthorizedForIssuance":
                var current = await SourceAsync(parish, item.SourceRecordId!, item, ct);
                if (current.Amendments.Length != item.SourceAmendments)
                    throw State("The registered entry was corrected after preparation; prepare and authorize the certificate again.");
                item.IssuedBy = actor.AccountId;
                item.IssuedAt = op.At;
                item.Status = "Issued";
                break;
            case "release" when item.Status == "Issued":
                // Handover records who checked which recipient, their relationship, the method and minimal evidence.
                item.RecipientName = Guard.Text(request.RecipientName, "Recipient", 200);
                item.RecipientRelationship = Guard.Text(request.RecipientRelationship, "Relationship to the subject", 100);
                item.VerificationMethod = request.VerificationMethod ?? throw new DomainException("invalid_input", "Record how the recipient was verified.");
                item.VerificationEvidence = Guard.Text(request.VerificationEvidence, "Verification evidence", 1000);
                item.ReleasedBy = actor.AccountId;
                item.ReleasedAt = op.At;
                item.Status = "Released";
                break;
            case "withdraw" when item.Status is "Issued" or "Released":
                item.WithdrawalReason = Guard.Text(request.Reason, "Withdrawal reason", 2000);
                item.Status = "Withdrawn";
                break;
            case "cancel" when item.Status is "WaitingForSource" or "Received" or "Prepared" or "Returned" or "AwaitingSignature":
                item.WithdrawalReason = Guard.Text(request.Reason, "Cancellation reason", 2000);
                item.Status = "Cancelled";
                break;
            default:
                throw State("This certificate action is not available in its current state.");
        }
        await records.CommitAsync(Scope(parish), op, "certificates." + request.Action.Replace('-', '_'), id,
            [Fence(root), RecordChange.Replace(Key(id), "certificate", item, Versions.Require(request.Version))], new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<Versioned<CertificateDto>> GetAsync(string parish, string id, CancellationToken ct)
    {
        await ReaderAsync(parish, ct);
        var row = await ReadAsync(parish, id, ct);
        return new Versioned<CertificateDto> { Version = row.Version, Value = Project(row.Value) };
    }

    public async Task<IReadOnlyList<Versioned<CertificateDto>>> ListAsync(string parish, string? status, CancellationToken ct)
    {
        await ReaderAsync(parish, ct);
        var rows = status is null
            ? await records.CollectAsync<Certificate>(Scope(parish), "certificate", ct, 2000)
            : await records.CollectAsync<Certificate>(Scope(parish), "certificate", ct, 2000, new RecordCondition { Path = "status", Comparison = "eq", Value = Guard.Text(status, "Status", 40) });
        return rows.OrderByDescending(r => r.Value.CreatedAt).Select(r => new Versioned<CertificateDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    // Office staff, the parish's priests and its bishop may read certificate work; nobody else.
    private async Task ReaderAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        try { await access.RequireAsync(parish, Permissions.SacramentsRecord, ct); return; }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden) { }
        try { await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct); return; }
        catch (DomainException) { }
        await bishops.RequireBishopAsync(await ArchdioceseAsync(parish, ct), ct);
    }

    private async Task<Versioned<Parish>> DeciderAsync(string parish, string id, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.Status == "AwaitingBishop")
            await bishops.RequireBishopAsync(await ArchdioceseAsync(parish, ct), ct);
        else
            await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        return await parishes.GetAsync(parish, ct) ?? throw Missing();
    }

    private async Task<SacramentRecord> SourceAsync(string parish, string source, Certificate item, CancellationToken ct)
    {
        var row = (await records.ReadAsync<SacramentRecord>(Scope(parish), "sacrament:" + source, ct))?.Value;
        if (row is null || row.ParishId != parish || row.Status != "Registered" || row.PersonId != item.PersonId || row.Kind != item.Kind)
            throw State("A certificate comes from this person's registered entry for the same sacrament.");
        return row;
    }

    private async Task<Versioned<Certificate>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<Certificate>(Scope(parish), Key(id), ct) ?? throw Missing();
        if (row.Value.Id != id || row.Value.ParishId != parish)
            throw Missing();
        return row;
    }

    private static CertificatePolicyStateDto Project(CertificatePolicy x) => new()
    {
        RequireBishopAcceptance = x.RequireBishopAcceptance, Reason = x.Reason, ApprovedBy = x.ApprovedBy, ApprovedAt = x.ApprovedAt
    };

    private static CertificateDto Project(Certificate x) => new()
    {
        Id = x.Id, Reference = x.Reference, Version = x.Version, ReplacesId = x.ReplacesId, SubjectPersonId = x.PersonId, Sacrament = x.Kind,
        SourceRecordId = x.SourceRecordId, RequestId = x.RequestId, Language = x.Language, Quantity = x.Quantity, Purpose = x.Purpose, Status = x.Status,
        Snapshot = new(x.Snapshot), OfficialNumber = x.OfficialNumber, BishopReviewRequired = x.BishopReviewRequired, PreparedBy = x.PreparedBy,
        SignedBy = x.SignedBy, SignedAt = x.SignedAt, AcceptedBy = x.AcceptedBy, AcceptedAt = x.AcceptedAt, ReturnReason = x.ReturnReason,
        IssuedBy = x.IssuedBy, IssuedAt = x.IssuedAt, ReleasedBy = x.ReleasedBy, ReleasedAt = x.ReleasedAt, RecipientName = x.RecipientName,
        RecipientRelationship = x.RecipientRelationship, VerificationMethod = x.VerificationMethod, WithdrawalReason = x.WithdrawalReason
    };
}
