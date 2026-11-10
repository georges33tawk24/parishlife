// Purpose: keeps authority-supplied certificate templates per sacrament and language (proposed by a parish priest, approved by the bishop)
// and renders a certificate as a printable HTML sheet from its own prepared snapshot, escaped, right-to-left for Arabic, and
// always labelled DRAFT or COPY: no format produced here is an official document by itself.
// Main functions: ProposeAsync, ApproveAsync, TemplatesAsync and RenderAsync.

using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using ParishLife.Api.DTOs.Sacraments;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Common;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Accounts;

namespace ParishLife.Api.Services.Sacraments;

public partial class DocumentSheetService(IRecordTransactions records, IParishRepository parishes, IClergyAuthority clergy, IArchdioceseAuthority bishops,
    CertificateService certificates, ICurrentActor actor, MfaAccountAccess proof, TimeProvider clock)
{
    private static readonly string[] Fields = ["name", "reference", "officialNumber", "celebratedAt", "place", "celebrantName", "witnesses", "bookReference", "issuedAt"];
    private static RecordScope Scope(string parish) => new() { Area = RecordArea.Parish, OwnerId = parish };
    private static DomainException State(string message) => new("invalid_template_state", message, FailureKind.Conflict);
    private static string Key(string kind, string language) => "documentTemplate:" + kind + ":" + language;

    [GeneratedRegex(@"\{\{([A-Za-z]+(?:\.[A-Za-z0-9_]+)?)\}\}")]
    private static partial Regex Placeholder();

    public async Task<DocumentTemplateDto> ProposeAsync(string parish, SaveDocumentTemplateDto request, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        var root = await parishes.GetAsync(parish, ct) ?? throw State("Unknown parish.");
        var body = Guard.Text(request.Body, "Template", 20000);
        var unknown = Placeholder().Matches(body).Select(m => m.Groups[1].Value).Where(p => !Fields.Contains(p) && !p.StartsWith("facts.", StringComparison.Ordinal)).Distinct().ToArray();
        if (unknown.Length > 0)
            throw new DomainException("invalid_input", "Unknown placeholders: " + string.Join(", ", unknown) + ". Use " + string.Join(", ", Fields) + " or facts.<key>.");
        var op = actor.CreateOperation(request.OperationId, request, clock, "document-template:v1:" + request.Kind + ":" + request.Language);
        var key = Key(request.Kind, request.Language);
        if (await records.ReplayAsync<CommandResult>(Scope(parish), op, ct) is null)
        {
            var old = await records.ReadAsync<DocumentTemplate>(Scope(parish), key, ct);
            // A new proposal replaces the wording and needs a fresh approval before it is used.
            var item = new DocumentTemplate { Kind = request.Kind, Language = request.Language, ParishId = parish, Body = body, ProposedBy = actor.AccountId, ProposedAt = op.At };
            await records.CommitAsync(Scope(parish), op, "document_template.propose", key,
                [RecordChange.Replace("parish", "parish", root.Value, root.Version), old is null ? RecordChange.Create(key, "documentTemplate", item) : RecordChange.Replace(key, "documentTemplate", item, old.Version)],
                new CommandResult { Id = key, Status = item.Status }, ct);
        }
        return Project((await records.ReadAsync<DocumentTemplate>(Scope(parish), key, ct))!.Value);
    }

    public async Task<DocumentTemplateDto> ApproveAsync(string parish, string kind, string language, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        var root = await parishes.GetAsync(parish, ct) ?? throw State("Unknown parish.");
        await bishops.RequireBishopAsync(root.Value.JurisdictionArchdioceseId ?? throw State("This parish has no bishop jurisdiction."), ct);
        var key = Key(kind, language);
        var row = await records.ReadAsync<DocumentTemplate>(Scope(parish), key, ct) ?? throw State("No proposed template for " + kind + " in " + language + ".");
        if (row.Value.Status != "Proposed")
            throw State("This template is already approved.");
        row.Value.Status = "Approved";
        row.Value.ApprovedBy = actor.AccountId;
        row.Value.ApprovedAt = clock.GetUtcNow();
        await records.CommitAsync(Scope(parish), Operation.Create(Guid.NewGuid(), actor.AccountId, new { kind, language }, clock, "document-template-approve:v1"),
            "document_template.approve", key, [RecordChange.Replace("parish", "parish", root.Value, root.Version), RecordChange.Replace(key, "documentTemplate", row.Value, row.Version)],
            new CommandResult { Id = key, Status = row.Value.Status }, ct);
        return Project(row.Value);
    }

    public async Task<IReadOnlyList<DocumentTemplateDto>> TemplatesAsync(string parish, CancellationToken ct)
    {
        await proof.RequireMfaAsync(ct);
        await clergy.RequireAsync(parish, actor.AccountId, "Priest", ct);
        return (await records.CollectAsync<DocumentTemplate>(Scope(parish), "documentTemplate", ct, 200)).Select(r => Project(r.Value)).ToArray();
    }

    public async Task<string> RenderAsync(string parish, string certificateId, CancellationToken ct)
    {
        var certificate = (await certificates.GetAsync(parish, certificateId, ct)).Value;
        var template = (await records.ReadAsync<DocumentTemplate>(Scope(parish), Key(certificate.Sacrament, certificate.Language), ct))?.Value;
        if (template?.Status != "Approved")
            throw State("There is no approved " + certificate.Language + " template for " + certificate.Sacrament + " certificates; preparing one is a task for the priest and bishop.");
        // The certificate's own snapshot (taken when it was prepared) is used, so later register or profile changes never alter it.
        var person = (await records.ReadAsync<Person>(Scope(parish), "person:" + certificate.SubjectPersonId, ct))?.Value;
        var facts = certificate.Snapshot;
        var values = new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            ["name"] = person is null ? null : person.GivenName + " " + person.FamilyName, ["reference"] = certificate.Reference, ["officialNumber"] = certificate.OfficialNumber,
            ["celebratedAt"] = facts.GetValueOrDefault("celebratedAt"), ["place"] = facts.GetValueOrDefault("place"), ["celebrantName"] = facts.GetValueOrDefault("celebrantName"),
            ["witnesses"] = facts.GetValueOrDefault("witnesses"), ["bookReference"] = facts.GetValueOrDefault("bookReference"),
            ["issuedAt"] = certificate.IssuedAt?.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture)
        };
        // The wording is escaped too, so only plain text and the filled values reach the page.
        var body = Placeholder().Replace(WebUtility.HtmlEncode(template.Body), m =>
        {
            var name = m.Groups[1].Value;
            var value = name.StartsWith("facts.", StringComparison.Ordinal) ? facts.GetValueOrDefault(name[6..]) : values.GetValueOrDefault(name);
            if (string.IsNullOrWhiteSpace(value)) { return "<span class=\"missing\">[" + WebUtility.HtmlEncode(name) + " not recorded]</span>"; }
            return WebUtility.HtmlEncode(value);
        });
        // Official validity comes from the issuing authority's signed and sealed paper, not from this file.
        var banner = certificate.Status is "Issued" or "Released"
            ? "COPY: official only as the signed and sealed paper issued by the parish."
            : "DRAFT: not valid; this certificate is " + certificate.Status + ".";
        var html = new StringBuilder("<!doctype html><html lang=\"").Append(template.Language).Append("\" dir=\"").Append(template.Language == "ar" ? "rtl" : "ltr")
            .Append("\"><head><meta charset=\"utf-8\"><title>").Append(WebUtility.HtmlEncode(certificate.Reference)).Append("</title><style>@page{size:A4;margin:20mm}")
            .Append(".banner{border:2px solid #000;padding:4mm;font-weight:bold}.missing{background:#eee}</style></head><body><p class=\"banner\" dir=\"ltr\">")
            .Append(WebUtility.HtmlEncode(banner)).Append("</p><div class=\"body\">").Append(body.Replace("\n", "<br>")).Append("</div></body></html>");
        return html.ToString();
    }

    private static DocumentTemplateDto Project(DocumentTemplate x) => new()
    {
        Kind = x.Kind, Language = x.Language, Body = x.Body, Status = x.Status, ProposedBy = x.ProposedBy, ProposedAt = x.ProposedAt, ApprovedBy = x.ApprovedBy, ApprovedAt = x.ApprovedAt
    };
}
