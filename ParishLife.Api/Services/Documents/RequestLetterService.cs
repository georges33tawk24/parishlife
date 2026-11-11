// Purpose: office letters for request cases, including guest requests (X04). The office drafts; a current parish priest (the printed
// authority, never the secretary) electronically authorizes the exact text; a releaser re-enters the request reference, addressee and content hash, which the server
// compares before release to a person checked in person or to the request's verified account; withdrawal and replacement keep history.
// Tracking links only list released letters: the text is never served to a bearer token.
// Main functions: CreateAsync, ReviseAsync, PreviewAsync, SignAsync, ReleaseAsync, WithdrawAsync, ListAsync (staff), MineAsync (applicant account)
// and GuestAsync (tracking token).

using ParishLife.Api.DTOs.Documents;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Communications;
using ParishLife.Api.Services.Ministries;
using ParishLife.Api.Services.Requests;

namespace ParishLife.Api.Services.Documents;

public class RequestLetterService(IRecordTransactions records, IParishAccess access, IParishRepository parishes, IClergyAuthority clergy, ICurrentActor actor, MfaAccountAccess proof, MinistryAccess own,
    RequestService requests, DocumentSignatureService signatures, NotificationService notifications, TimeProvider clock)
{
    private const string Collection = "Collect the signed letter at the parish office with identification, or ask the office to link a verified account. A tracking link does not download letters.";
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static string Key(string id) => "requestLetter:" + id;
    private static DomainException Missing() => new("resource_not_found", "The requested letter is unavailable.", FailureKind.NotFound);
    private static DomainException State(string message) => new("invalid_letter_state", message, FailureKind.Conflict);
    private static RecordChange Fence(Versioned<Parish> root) => RecordChange.Replace("parish", "parish", root.Value, root.Version);

    public async Task<LetterDto> CreateAsync(string parish, string requestId, CreateLetterDto request, CancellationToken ct)
    {
        var root = await StaffAsync(parish, Permissions.RequestsManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "request-letter:v1:" + requestId);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is { } prior)
            return Project((await ReadAsync(parish, prior.Id, ct)).Value);
        var source = Open((await RequestAsync(parish, requestId, ct)).Value);
        var item = new RequestLetter
        {
            Id = op.Id, ParishId = parish, RequestId = source.Id, Reference = "L-" + op.Id[..10].ToUpperInvariant(), Version = 1,
            Language = request.Language is "en" or "fr" or "ar" ? request.Language : throw new DomainException("invalid_input", "Use en, fr or ar."),
            DraftedBy = actor.AccountId, DraftedAt = op.At, UpdatedAt = op.At, NotificationWorkIds = []
        };
        SetText(item, request.Title, request.Body, request.AddresseeName);
        if (request.ReplacesLetterId is { } replaces)
        {
            // A replacement is a new letter with its own reference and version; it repeats signing and release.
            var old = (await ReadAsync(parish, Guard.Id(replaces), ct)).Value;
            if (old.RequestId != source.Id || old.Status is not ("Signed" or "Released" or "Withdrawn") || old.SupersededById is not null)
                throw State("Only the current signed letter of this request can be replaced.");
            item.ReplacesId = old.Id;
            item.Version = old.Version + 1;
            item.ReplaceReason = Guard.Text(request.ReplaceReason, "Replacement reason", 2000);
        }
        await records.CommitAsync(Scope(parish), op, "request_letter.create", item.Id, [Fence(root), RecordChange.Create(Key(item.Id), "requestLetter", item)],
            new CommandResult { Id = item.Id, Status = item.Status }, ct);
        return Project(item);
    }

    public async Task<LetterDto> ReviseAsync(string parish, string id, ReviseLetterDto request, CancellationToken ct)
    {
        var root = await StaffAsync(parish, Permissions.RequestsManage, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "request-letter-revise:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is null)
        {
            var item = (await ReadAsync(parish, id, ct)).Value;
            if (item.Status != "Draft")
                throw State("A signed letter is never edited; draft a replacement instead.");
            SetText(item, request.Title, request.Body, request.AddresseeName);
            item.UpdatedAt = op.At;
            await records.CommitAsync(Scope(parish), op, "request_letter.revise", id, [Fence(root), RecordChange.Replace(Key(id), "requestLetter", item, Versions.Require(request.Version))],
                new CommandResult { Id = id, Status = item.Status }, ct);
        }
        return Project((await ReadAsync(parish, id, ct)).Value);
    }

    public async Task<AuthorizationPreviewDto> PreviewAsync(string parish, string id, CancellationToken ct)
    {
        await ReaderAsync(parish, ct);
        var item = (await ReadAsync(parish, id, ct)).Value;
        var content = Content(item, (await RequestAsync(parish, item.RequestId, ct)).Value);
        return new AuthorizationPreviewDto
        {
            DocumentType = "Letter", DocumentId = item.Id, Reference = item.Reference, Version = item.Version, Content = content,
            ContentHash = DocumentSignatureService.Hash(content), CurrentCode = item.SignatureCode, Statement = DocumentSignatureService.NotOfficial
        };
    }

    // The printed authority on a parish letter is a current parish priest acting in that capacity (S14.10/S15.09); office staff draft only.
    // ponytail: no delegated non-priest letter signer; add one only when the competent authority names that role (U05).
    public async Task<LetterDto> SignAsync(string parish, string id, AuthorizeDocumentDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        await access.RequireModuleAsync(parish, "requests", ct);
        var root = await parishes.GetAsync(parish, ct) ?? throw Missing();
        // The authenticator code is a credential and never enters the operation fingerprint.
        var op = actor.CreateOperation(request.OperationId, new { request.Version, request.ExpectedContentHash }, clock, "request-letter-sign:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)).Value);
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.Status != "Draft")
            throw State("Only a draft letter can be signed.");
        var source = Open((await RequestAsync(parish, item.RequestId, ct)).Value);
        var changes = new List<RecordChange> { Fence(root) };
        if (item.ReplacesId is { } replaced)
        {
            var old = await ReadAsync(parish, replaced, ct);
            if (old.Value.SupersededById is not null)
                throw State("The letter this draft replaces was already replaced.");
            old.Value.SupersededById = item.Id;
            changes.Add(RecordChange.Replace(Key(old.Value.Id), "requestLetter", old.Value, old.Version));
        }
        var (signature, change) = await signatures.PrepareAsync(parish, "Letter", item.Id, item.Reference, item.Version, Content(item, source),
            "Parish priest", request, op.At, ct);
        item.Status = "Signed";
        item.SignatureCode = signature.Code;
        item.SignedBy = actor.AccountId;
        item.SignedAt = op.At;
        item.UpdatedAt = op.At;
        changes.Add(RecordChange.Replace(Key(id), "requestLetter", item, Versions.Require(request.Version)));
        changes.Add(change);
        await records.CommitAsync(Scope(parish), op, "request_letter.sign", id, changes, new CommandResult { Id = id, Status = item.Status }, ct);
        return Project(item);
    }

    // S15.09: release is blocked unless the re-entered request, addressee and exact signed content match and the recipient route is verified.
    public async Task<LetterDto> ReleaseAsync(string parish, string id, ReleaseLetterDto request, CancellationToken ct)
    {
        var root = await StaffAsync(parish, Permissions.DocumentsRelease, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "request-letter-release:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)).Value);
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.Status != "Signed" || item.SupersededById is not null)
            throw State("Only the current signed, unreleased letter can be released.");
        var signature = await signatures.ReadAsync(parish, item.SignatureCode!, ct);
        if (signature is null || signature.RevokedAt is not null)
            throw State("This letter's authorization was revoked; draft and sign a replacement.");
        var sourceRow = await RequestAsync(parish, item.RequestId, ct);
        var source = Open(sourceRow.Value);
        if (request.ConfirmRequestReference.Trim() != source.Reference || request.ConfirmAddresseeName.Trim() != item.AddresseeName
            || request.ConfirmContentHash != signature.ContentHash)
            throw new DomainException("release_mismatch", "The request, addressee or signed content you confirmed does not match this letter; nothing was released.", FailureKind.Conflict);
        string? recipient = null;
        if (request.Method == "VerifiedAccount")
        {
            // Only the request's own or office-reviewed applicant account; a guest tracking token never qualifies.
            if (!Guid.TryParse(source.ApplicantAccountId, out var account) || account == Guid.Empty)
                throw State("This request has no verified applicant account; release in person at the office instead.");
            recipient = Guard.Id(account);
            item.ReleaseEvidence = string.IsNullOrWhiteSpace(request.VerificationEvidence) ? "Request applicant account" : Guard.Text(request.VerificationEvidence, "Verification evidence", 1000);
        }
        else
            item.ReleaseEvidence = Guard.Text(request.VerificationEvidence, "Verification evidence", 1000);
        item.Status = "Released";
        item.ReleaseMethod = request.Method;
        item.ReleasedBy = actor.AccountId;
        item.ReleasedAt = op.At;
        item.UpdatedAt = op.At;
        await CommitWithNoticeAsync(parish, op, "request_letter.release", item, Versions.Require(request.Version), root, sourceRow, recipient, ct);
        return Project((await ReadAsync(parish, id, ct)).Value);
    }

    public async Task<LetterDto> WithdrawAsync(string parish, string id, WithdrawLetterDto request, CancellationToken ct)
    {
        var root = await StaffAsync(parish, Permissions.DocumentsRelease, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "request-letter-withdraw:v1:" + id);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is not null)
            return Project((await ReadAsync(parish, id, ct)).Value);
        var item = (await ReadAsync(parish, id, ct)).Value;
        if (item.Status is not ("Signed" or "Released"))
            throw State("Only a signed or released letter can be withdrawn.");
        var sourceRow = await RequestAsync(parish, item.RequestId, ct);
        // Withdrawal stops future access; what was released, to whom and when stays recorded, and handed-over copies cannot be recalled.
        var recipient = item.ReleaseMethod == "VerifiedAccount" && Guid.TryParse(sourceRow.Value.ApplicantAccountId, out var account) && account != Guid.Empty
            ? Guard.Id(account) : null;
        item.Status = "Withdrawn";
        item.WithdrawnBy = actor.AccountId;
        item.WithdrawnAt = op.At;
        item.WithdrawalReason = Guard.Text(request.Reason, "Withdrawal reason", 2000);
        item.UpdatedAt = op.At;
        await CommitWithNoticeAsync(parish, op, "request_letter.withdraw", item, Versions.Require(request.Version), root, sourceRow, recipient, ct);
        return Project((await ReadAsync(parish, id, ct)).Value);
    }

    public async Task<IReadOnlyList<Versioned<LetterDto>>> ListAsync(string parish, string requestId, CancellationToken ct)
    {
        await ReaderAsync(parish, ct);
        await RequestAsync(parish, requestId, ct);
        return (await LettersAsync(parish, requestId, ct)).Select(r => new Versioned<LetterDto> { Version = r.Version, Value = Project(r.Value) }).ToArray();
    }

    // The request's own applicant account sees released letters; the text only when it was released to that account.
    public async Task<IReadOnlyList<ApplicantLetterDto>> MineAsync(string parish, string requestId, CancellationToken ct)
    {
        await own.PersonalAsync(ct);
        var source = (await RequestAsync(parish, requestId, ct)).Value;
        if (source.ApplicantAccountId != actor.AccountId)
            throw Missing();
        var result = new List<ApplicantLetterDto>();
        foreach (var row in await LettersAsync(parish, requestId, ct))
        {
            if (row.Value.ReleasedAt is null) continue;
            var letter = Applicant(row.Value);
            if (row.Value is { Status: "Released", ReleaseMethod: "VerifiedAccount", SupersededById: null })
            {
                var signature = await signatures.ReadAsync(parish, row.Value.SignatureCode!, ct);
                letter.Body = row.Value.Body;
                letter.SignerName = signature?.SignerName;
                letter.VerificationCode = row.Value.SignatureCode;
                letter.Statement = signature?.ArrangementReference is null ? DocumentSignatureService.NotOfficial
                    : "Electronically authorized under the issuing authority's recorded arrangement " + signature.ArrangementReference + "; check its current status with the verification code.";
            }
            result.Add(letter);
        }
        return result;
    }

    // S15.11: a tracking token reveals only which letters were released or withdrawn, never their text or verification code.
    public async Task<IReadOnlyList<ApplicantLetterDto>> GuestAsync(string parish, string requestId, string? token, CancellationToken ct)
    {
        var source = (await requests.GuestCaseAsync(parish, requestId, token, ct)).Value;
        return (await LettersAsync(parish, source.Id, ct)).Where(r => r.Value.ReleasedAt is not null).Select(r => Applicant(r.Value)).ToArray();
    }

    private async Task CommitWithNoticeAsync(string parish, Operation op, string action, RequestLetter item, string version, Versioned<Parish> root,
        Versioned<ParishRequest> source, string? recipient, CancellationToken ct)
    {
        // The request is fenced so a concurrent applicant/association change cannot release to a stale recipient.
        var changes = new List<RecordChange> { Fence(root), RecordChange.Replace("request:" + source.Value.Id, "parishRequest", source.Value, source.Version) };
        item.NotificationWorkIds = [];
        if (recipient is not null)
        {
            var notice = notifications.StageRequired(parish, recipient, "letter.update", "There is an update to your request.",
                "/api/parishes/" + parish + "/requests/" + source.Value.Id, "letter:" + op.Id, "RequestApplicant", source.Value.Id, op.At);
            changes.Add(notice);
            item.NotificationWorkIds = [((NotificationWork)notice.Value!).Id];
        }
        changes.Add(RecordChange.Replace(Key(item.Id), "requestLetter", item, version));
        await records.CommitAsync(Scope(parish), op, action, item.Id, changes, new CommandResult { Id = item.Id, Status = item.Status }, ct);
        if (recipient is not null)
            await notifications.DispatchAsync(parish, recipient, "letter:" + op.Id, ct);
    }

    private static Dictionary<string, string> Content(RequestLetter item, ParishRequest source) => new(StringComparer.Ordinal)
    {
        ["documentType"] = "Letter", ["reference"] = item.Reference, ["version"] = item.Version.ToString(System.Globalization.CultureInfo.InvariantCulture),
        ["language"] = item.Language, ["requestId"] = source.Id, ["requestReference"] = source.Reference, ["addresseeName"] = item.AddresseeName,
        ["title"] = item.Title, ["body"] = item.Body, ["replacesId"] = item.ReplacesId ?? ""
    };

    private static void SetText(RequestLetter item, string title, string body, string addressee)
    {
        item.Title = Guard.Text(title, "Title", 200);
        item.Body = Guard.Text(body, "Body", 8000);
        item.AddresseeName = Guard.Text(addressee, "Addressee", 200);
    }

    private static ParishRequest Open(ParishRequest source)
        => source.Status is "Withdrawn" or "Cancelled" ? throw State("This request was withdrawn or cancelled.") : source;

    private async Task<Versioned<Parish>> StaffAsync(string parish, string permission, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await access.RequireAsync(parish, permission, ct);
        await access.RequireModuleAsync(parish, "requests", ct);
        return root;
    }

    private async Task ReaderAsync(string parish, CancellationToken ct)
    {
        foreach (var permission in new[] { Permissions.RequestsManage, Permissions.DocumentsRelease })
        {
            try { await StaffAsync(parish, permission, ct); return; }
            catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden) { }
        }
        await proof.RequireMfaAsync(ct);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        await access.RequireModuleAsync(parish, "requests", ct);
    }

    private async Task<Versioned<ParishRequest>> RequestAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<ParishRequest>(Scope(parish), "request:" + id, ct);
        if (row is null || row.Value.Id != id || row.Value.ParishId != parish) throw Missing();
        return row;
    }

    private async Task<Versioned<RequestLetter>> ReadAsync(string parish, string id, CancellationToken ct)
    {
        var row = await records.ReadAsync<RequestLetter>(Scope(parish), Key(id), ct);
        if (row is null || row.Value.Id != id || row.Value.ParishId != parish) throw Missing();
        return row;
    }

    private async Task<IReadOnlyList<Versioned<RequestLetter>>> LettersAsync(string parish, string requestId, CancellationToken ct)
        => (await records.CollectAsync<RequestLetter>(Scope(parish), "requestLetter", ct, 200, new RecordCondition { Path = "requestId", Comparison = "eq", Value = requestId }))
            .Where(r => r.Value.ParishId == parish && r.Value.RequestId == requestId).OrderBy(r => r.Value.Version).ThenBy(r => r.Value.DraftedAt).ToArray();

    private static ApplicantLetterDto Applicant(RequestLetter x) => new()
    {
        Reference = x.Reference, Version = x.Version, Title = x.Title, Language = x.Language, ReleasedAt = x.ReleasedAt, ReleaseMethod = x.ReleaseMethod,
        Status = x.Status == "Withdrawn" ? "Withdrawn" : x.SupersededById is not null ? "Superseded" : x.Status,
        Statement = x.Status == "Withdrawn"
            ? "The parish withdrew this letter. Copies already handed over cannot be recalled; contact the parish office."
            : x.SupersededById is not null ? "A newer version replaced this letter; contact the parish office." : Collection
    };

    private static LetterDto Project(RequestLetter x) => new()
    {
        Id = x.Id, RequestId = x.RequestId, Reference = x.Reference, Version = x.Version, ReplacesId = x.ReplacesId, ReplaceReason = x.ReplaceReason,
        SupersededById = x.SupersededById, Title = x.Title, Body = x.Body, Language = x.Language, AddresseeName = x.AddresseeName, Status = x.Status,
        DraftedBy = x.DraftedBy, DraftedAt = x.DraftedAt, SignatureCode = x.SignatureCode, SignedBy = x.SignedBy, SignedAt = x.SignedAt,
        ReleasedBy = x.ReleasedBy, ReleasedAt = x.ReleasedAt, ReleaseMethod = x.ReleaseMethod, ReleaseEvidence = x.ReleaseEvidence,
        WithdrawnBy = x.WithdrawnBy, WithdrawnAt = x.WithdrawnAt, WithdrawalReason = x.WithdrawalReason
    };
}
