// Purpose: electronic authorization of exact document versions (X03) and their public verification and revocation (X05).
// Each authorization is an immutable record of the exact canonical content, its SHA-256 and a server Data Protection seal, made by a
// current authority with MFA and a fresh authenticator confirmation; the official status follows the bishop's recorded arrangement,
// which defaults to not approved, so the wet-signed and sealed paper stays the official document.
// Main functions: ProfileAsync/SaveProfileAsync (personal signer setup), ArrangementAsync/SetArrangementAsync (bishop), PrepareAsync and Hash
// (used by certificate and letter flows), VerifyAsync (anonymous, minimal), GetAsync (staff) and RevokeAsync; StatusAsync derives the current
// outcome from the signed document without rewriting history.

using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.DTOs.Documents;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Ministries;

namespace ParishLife.Api.Services.Documents;

public class DocumentSignatureService(IRecordTransactions records, IParishAccess access, IParishRepository parishes, IClergyAuthority clergy,
    IArchdioceseAuthority bishops, ICurrentActor actor, MfaAccountAccess proof, MinistryAccess own, IDataProtectionProvider protection, TimeProvider clock)
{
    internal const string NotOfficial = "Reference only: no approved electronic-signature arrangement was recorded by the issuing authority, so the official document is the wet-signed and sealed paper issued by the parish. A code or QR alone does not prove a signature.";
    private static readonly RecordScope PointerScope = new() { Area = RecordArea.Platform, OwnerId = "document-verification" };
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static RecordScope AccountScope(string account) => new() { Area = RecordArea.Account, OwnerId = account };
    private static RecordScope ArchdioceseScope(string archdiocese) => new() { Area = RecordArea.Archdiocese, OwnerId = archdiocese };
    private static string Key(string code) => "documentSignature:" + code;
    private static DomainException Unknown() => new("resource_not_found", "No authorized document matches this code.", FailureKind.NotFound);
    private IDataProtector Protector() => protection.CreateProtector("ParishLife.DocumentSignatures.v1");

    public async Task<SignerProfileDto> ProfileAsync(CancellationToken ct)
    {
        await PersonalAsync(ct);
        var row = await records.ReadAsync<SignerProfile>(AccountScope(actor.AccountId), "signerProfile", ct)
            ?? throw new DomainException("resource_not_found", "No signer profile is set up.", FailureKind.NotFound);
        return new SignerProfileDto { PrintedName = row.Value.PrintedName, UpdatedAt = row.Value.UpdatedAt, Version = row.Version };
    }

    public async Task<Versioned<SignerProfileDto>> SaveProfileAsync(SaveSignerProfileDto request, CancellationToken ct)
    {
        await PersonalAsync(ct);
        var scope = AccountScope(actor.AccountId);
        var op = actor.CreateOperation(request.OperationId, request, clock, "signer-profile:v1");
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is null)
        {
            var existing = await records.ReadAsync<SignerProfile>(scope, "signerProfile", ct);
            var profile = new SignerProfile { AccountId = actor.AccountId, PrintedName = Guard.Text(request.PrintedName, "Printed name", 200), UpdatedAt = op.At };
            await records.CommitAsync(scope, op, "documents.signer_profile", actor.AccountId,
                [existing is null ? RecordChange.Create("signerProfile", "signerProfile", profile) : RecordChange.Replace("signerProfile", "signerProfile", profile, Versions.Require(request.Version))],
                new CommandResult { Id = actor.AccountId, Status = "Saved" }, ct);
        }
        var row = (await records.ReadAsync<SignerProfile>(scope, "signerProfile", ct))!;
        return new Versioned<SignerProfileDto> { Version = row.Version, Value = new SignerProfileDto { PrintedName = row.Value.PrintedName, UpdatedAt = row.Value.UpdatedAt, Version = row.Version } };
    }

    public async Task<SignatureArrangementStateDto> ArrangementAsync(string archdiocese, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await bishops.RequireBishopAsync(archdiocese, ct);
        return Project((await records.ReadAsync<SignatureArrangement>(ArchdioceseScope(archdiocese), "signatureArrangement", ct))?.Value);
    }

    // Records the competent authority's actual decision; the system never infers an arrangement from configuration or a provider.
    public async Task<SignatureArrangementStateDto> SetArrangementAsync(string archdiocese, SignatureArrangementDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await bishops.RequireBishopAsync(archdiocese, ct);
        var scope = ArchdioceseScope(archdiocese);
        var op = actor.CreateOperation(request.OperationId, request, clock, "signature-arrangement:v1:" + archdiocese);
        if (await records.ReplayAsync<CommandResult>(scope, op, ct) is null)
        {
            var approved = request.Approved ?? throw new DomainException("invalid_input", "State whether an electronic-signature arrangement is approved.");
            var item = new SignatureArrangement
            {
                ArchdioceseId = archdiocese, Approved = approved, Reason = Guard.Text(request.Reason, "Reason", 2000), RecordedBy = actor.AccountId, RecordedAt = op.At,
                ApprovalReference = approved ? Guard.Text(request.ApprovalReference, "Approval reference", 300) : null
            };
            var existing = await records.ReadAsync<SignatureArrangement>(scope, "signatureArrangement", ct);
            await records.CommitAsync(scope, op, "documents.signature_arrangement", archdiocese,
                [existing is null ? RecordChange.Create("signatureArrangement", "signatureArrangement", item) : RecordChange.Replace("signatureArrangement", "signatureArrangement", item, existing.Version)],
                new CommandResult { Id = archdiocese, Status = approved ? "Approved" : "NotApproved" }, ct);
        }
        return Project((await records.ReadAsync<SignatureArrangement>(scope, "signatureArrangement", ct))?.Value);
    }

    // Canonical content: ordinal-sorted keys serialized as JSON, hashed with SHA-256.
    internal static string Hash(Dictionary<string, string> content)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new SortedDictionary<string, string>(content, StringComparer.Ordinal)))));

    // Validates the exact previewed content and a fresh authenticator confirmation, then writes the public lookup pointer.
    // The caller commits the returned signature change with its own document transition in the parish partition.
    internal async Task<(DocumentSignature Signature, RecordChange Change)> PrepareAsync(string parish, string type, string id, string reference, int version,
        Dictionary<string, string> content, string authority, AuthorizeDocumentDto request, DateTimeOffset at, CancellationToken ct)
    {
        var profile = (await records.ReadAsync<SignerProfile>(AccountScope(actor.AccountId), "signerProfile", ct))?.Value
            ?? throw new DomainException("signer_profile_required", "Set up your printed signer name before authorizing documents.", FailureKind.Conflict);
        var hash = Hash(content);
        if (!string.Equals(hash, request.ExpectedContentHash, StringComparison.Ordinal))
            throw new DomainException("document_content_changed", "The document is not the version that was previewed; review the current version before authorizing it.", FailureKind.Conflict);
        // A deliberate personal confirmation for this one document; failures count toward lockout and the code is never stored.
        // ponytail: a TOTP code may be reused within its time step; upgrade to a one-use server challenge or passkey assertion when U10 allows.
        await proof.AuthenticatorAsync(await proof.RequireMfaAsync(ct), request.AuthenticatorCode);
        var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var signature = new DocumentSignature
        {
            Code = code, ParishId = parish, DocumentType = type, DocumentId = id, DocumentReference = reference, DocumentVersion = version,
            Content = new Dictionary<string, string>(content, StringComparer.Ordinal), ContentHash = hash, SignerAccountId = actor.AccountId,
            SignerName = profile.PrintedName, SignerAuthority = authority, ActingAppointmentId = actor.ActingAppointmentId, SignedAt = at,
            ArrangementReference = await ArrangementReferenceAsync(parish, ct)
        };
        signature.Seal = Protector().Protect(SealPayload(signature));
        // The pointer is written first: if the document commit then fails, the orphan pointer only resolves to "not found".
        await records.CommitAsync(PointerScope, Operation.Create(Guid.NewGuid(), actor.AccountId, new { code }, clock, "document-verification:v1"),
            "documents.verification_pointer", code, [RecordChange.Create("documentVerification:" + code, "documentVerification", new DocumentVerificationPointer { Code = code, ParishId = parish })],
            new CommandResult { Id = code, Status = "Pointer" }, ct);
        return (signature, RecordChange.Create(Key(code), "documentSignature", signature));
    }

    // Anonymous and rate limited: only status, type/reference, parish, printed authority and an honest official-status statement.
    public async Task<DocumentVerificationDto> VerifyAsync(string? code, CancellationToken ct)
    {
        var normalized = Normalize(code) ?? throw Unknown();
        var pointer = (await records.ReadAsync<DocumentVerificationPointer>(PointerScope, "documentVerification:" + normalized, ct))?.Value ?? throw Unknown();
        var signature = await ReadAsync(pointer.ParishId, normalized, ct) ?? throw Unknown();
        var parish = (await parishes.GetAsync(signature.ParishId, ct))?.Value ?? throw Unknown();
        var status = await StatusAsync(signature, ct);
        var recognized = signature.ArrangementReference is not null && status != "IntegrityCheckFailed";
        return new DocumentVerificationDto
        {
            Code = signature.Code, Status = status, StatusMeaning = Meaning(status), DocumentType = signature.DocumentType,
            DocumentDetail = signature.DocumentType == "Certificate" ? signature.Content.GetValueOrDefault("sacrament") : null,
            Reference = signature.DocumentReference, DocumentVersion = signature.DocumentVersion, IssuingParish = parish.Name,
            AuthorizedBy = signature.SignerName + ", " + signature.SignerAuthority, AuthorizedAt = signature.SignedAt, ElectronicSignatureRecognized = recognized,
            OfficialStatement = recognized
                ? "The issuing authority recorded an approved electronic-signature arrangement (" + signature.ArrangementReference + ") when this document was authorized. A Valid result confirms this exact version was electronically authorized under it."
                : NotOfficial,
            CheckedAt = clock.GetUtcNow()
        };
    }

    public async Task<Versioned<DocumentSignatureDto>> GetAsync(string parish, string code, CancellationToken ct)
    {
        await ReaderAsync(parish, ct);
        var normalized = Normalize(code) ?? throw Unknown();
        var row = await records.ReadAsync<DocumentSignature>(Scope(parish), Key(normalized), ct);
        if (row is null || row.Value.ParishId != parish || row.Value.Code != normalized) throw Unknown();
        return new Versioned<DocumentSignatureDto> { Version = row.Version, Value = await ProjectAsync(row.Value, ct) };
    }

    // Revocation is append-only: the record, content and seal stay; the public outcome becomes Revoked without the reason.
    public async Task<DocumentSignatureDto> RevokeAsync(string parish, string code, RevokeSignatureDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var normalized = Normalize(code) ?? throw Unknown();
        var row = await records.ReadAsync<DocumentSignature>(Scope(parish), Key(normalized), ct);
        if (row is null || row.Value.ParishId != parish || row.Value.Code != normalized) throw Unknown();
        var root = await RevokerAsync(parish, ct);
        var op = actor.CreateOperation(request.OperationId, request, clock, "document-signature-revoke:v1:" + normalized);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is null)
        {
            var item = row.Value;
            if (item.RevokedAt is not null)
                throw new DomainException("invalid_signature_state", "This authorization is already revoked.", FailureKind.Conflict);
            item.RevokedBy = actor.AccountId;
            item.RevokedAt = op.At;
            item.RevocationReason = Guard.Text(request.Reason, "Revocation reason", 2000);
            await records.CommitAsync(Scope(parish), op, "documents.signature_revoke", normalized,
                [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Replace(Key(normalized), "documentSignature", item, row.Version)],
                new CommandResult { Id = normalized, Status = "Revoked" }, ct);
        }
        return await ProjectAsync((await ReadAsync(parish, normalized, ct))!, ct);
    }

    internal async Task<DocumentSignature?> ReadAsync(string parish, string code, CancellationToken ct)
    {
        var row = (await records.ReadAsync<DocumentSignature>(Scope(parish), Key(code), ct))?.Value;
        return row?.ParishId == parish && row.Code == code ? row : null;
    }

    // The current outcome is derived from the signed document, so returns, withdrawals and replacements never rewrite the signature.
    internal async Task<string> StatusAsync(DocumentSignature s, CancellationToken ct)
    {
        if (!Intact(s)) return "IntegrityCheckFailed";
        if (s.RevokedAt is not null) return "Revoked";
        if (s.DocumentType == "Certificate")
        {
            var c = (await records.ReadAsync<Certificate>(Scope(s.ParishId), "certificate:" + s.DocumentId, ct))?.Value;
            if (c is null || c.Id != s.DocumentId) return "Invalidated";
            if (c.Status == "Withdrawn") return "Withdrawn";
            if (c.SupersededById is not null) return "Superseded";
            if (c.AuthorizationCode != s.Code) return "Invalidated";
            return c.Status is "Issued" or "Released" ? "Valid" : c.Status is "AwaitingBishop" or "AuthorizedForIssuance" ? "NotYetIssued" : "Invalidated";
        }
        var l = (await records.ReadAsync<RequestLetter>(Scope(s.ParishId), "requestLetter:" + s.DocumentId, ct))?.Value;
        if (l is null || l.Id != s.DocumentId || l.SignatureCode != s.Code) return "Invalidated";
        if (l.Status == "Withdrawn") return "Withdrawn";
        if (l.SupersededById is not null) return "Superseded";
        return l.Status == "Released" ? "Valid" : l.Status == "Signed" ? "NotYetIssued" : "Invalidated";
    }

    internal static string? Normalize(string? code)
    {
        var value = code?.Replace("-", "", StringComparison.Ordinal).Replace(" ", "", StringComparison.Ordinal).ToUpperInvariant();
        return value is { Length: 32 } && value.All(Uri.IsHexDigit) ? value : null;
    }

    private bool Intact(DocumentSignature s)
    {
        if (Hash(s.Content) != s.ContentHash) return false;
        try { return Protector().Unprotect(s.Seal) == SealPayload(s); }
        catch (CryptographicException) { return false; }
    }

    private static string SealPayload(DocumentSignature s) => string.Join('\n', s.Code, s.ParishId, s.DocumentType, s.DocumentId,
        s.DocumentVersion.ToString(System.Globalization.CultureInfo.InvariantCulture), s.ContentHash, s.SignerAccountId, s.SignerName, s.SignerAuthority,
        s.SignedAt.UtcTicks.ToString(System.Globalization.CultureInfo.InvariantCulture), s.ArrangementReference ?? "");

    private async Task<string?> ArrangementReferenceAsync(string parish, CancellationToken ct)
    {
        if ((await parishes.GetAsync(parish, ct))?.Value.JurisdictionArchdioceseId is not { } archdiocese) return null;
        var arrangement = (await records.ReadAsync<SignatureArrangement>(ArchdioceseScope(archdiocese), "signatureArrangement", ct))?.Value;
        return arrangement is { Approved: true } ? arrangement.ApprovalReference : null;
    }

    // Signer setup is personal: no selected organizational capacity and no recovery session.
    private async Task PersonalAsync(CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await own.PersonalAsync(ct);
    }

    private async Task ReaderAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        try { await access.RequireAsync(parish, Permissions.DocumentsRelease, ct); return; }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden) { }
        try { await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct); return; }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden) { }
        await bishops.RequireBishopAsync((await parishes.GetAsync(parish, ct))?.Value.JurisdictionArchdioceseId ?? throw Unknown(), ct);
    }

    // A current parish priest (the signing authority for certificates and letters) or the jurisdiction bishop may revoke.
    private async Task<Versioned<Parish>> RevokerAsync(string parish, CancellationToken ct)
    {
        var root = await parishes.GetAsync(parish, ct) ?? throw Unknown();
        try
        {
            await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
            return root;
        }
        catch (DomainException error) when (error.Kind is FailureKind.NotFound or FailureKind.Forbidden) { }
        await bishops.RequireBishopAsync(root.Value.JurisdictionArchdioceseId ?? throw Unknown(), ct);
        return root;
    }

    private async Task<DocumentSignatureDto> ProjectAsync(DocumentSignature s, CancellationToken ct) => new()
    {
        Code = s.Code, DocumentType = s.DocumentType, DocumentId = s.DocumentId, DocumentReference = s.DocumentReference, DocumentVersion = s.DocumentVersion,
        Content = new(s.Content), ContentHash = s.ContentHash, SignerAccountId = s.SignerAccountId, SignerName = s.SignerName, SignerAuthority = s.SignerAuthority,
        SignedAt = s.SignedAt, ArrangementReference = s.ArrangementReference, Status = await StatusAsync(s, ct), IntegrityVerified = Intact(s),
        RevokedBy = s.RevokedBy, RevokedAt = s.RevokedAt, RevocationReason = s.RevocationReason
    };

    private static SignatureArrangementStateDto Project(SignatureArrangement? x) => x is null ? new SignatureArrangementStateDto() : new()
    {
        Approved = x.Approved, ApprovalReference = x.ApprovalReference, Reason = x.Reason, RecordedBy = x.RecordedBy, RecordedAt = x.RecordedAt
    };

    private static string Meaning(string status) => status switch
    {
        "Valid" => "This exact document version was electronically authorized and has not been withdrawn, replaced or revoked.",
        "NotYetIssued" => "This version was authorized, but the parish has not yet issued or released it.",
        "Superseded" => "A newer version replaced this document; ask the issuing parish for the current one.",
        "Withdrawn" => "The parish withdrew this document. Copies already handed over or downloaded cannot be recalled and should not be relied on.",
        "Revoked" => "This authorization was revoked by the parish or its bishop.",
        "IntegrityCheckFailed" => "The stored authorization failed its integrity check; contact the issuing parish.",
        _ => "This authorization no longer matches the document; it was returned for correction or cancelled."
    };
}
