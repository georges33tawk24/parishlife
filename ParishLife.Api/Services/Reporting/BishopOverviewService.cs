// Purpose: the bishop's oversight of parishes in his current jurisdiction: labelled per-parish aggregate counts for an explicit period and a
// map projection of recorded parish coordinates. Only a current accepted bishop with MFA (and, if selected, exactly that appointment) may read
// it. Counts never include confidential concerns, pastoral notes, incidents, medical or finance data, and parishes are listed alphabetically,
// never ranked. Oversight grants no drill-down into records; existing endpoints keep their own permissions.
// Main functions: OverviewAsync and MapAsync; ParishesAsync selects parishes whose recorded jurisdiction is this archdiocese.

using ParishLife.Api.DTOs.Reporting;
using ParishLife.Api.Interfaces.Repositories.Common;
using ParishLife.Api.Interfaces.Repositories.Organizations;
using ParishLife.Api.Interfaces.Services.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Services.Organizations;
using ParishLife.Api.Services.Requests;

namespace ParishLife.Api.Services.Reporting;

public class BishopOverviewService(IRecordTransactions records, IParishDirectory directory, IArchdioceseAuthority bishops, TimeProvider clock)
{
    // Technical bounds that protect the synchronous read; they are not agreed product limits.
    internal const int MaximumParishes = 200;
    internal static readonly TimeSpan MaximumPeriod = TimeSpan.FromDays(366);

    private static readonly MeasureDefinitionDto[] Measures =
    [
        new() { Key = "currentPriests", Basis = "now", Definition = "Distinct accounts holding an accepted, currently effective priest appointment in the parish. Jurisdiction total counts each priest once." },
        new() { Key = "headPriestDesignated", Basis = "now", Definition = "Whether a currently effective priest appointment carries a current head-priest period." },
        new() { Key = "otherCurrentStaff", Basis = "now", Definition = "Accepted, currently effective non-priest staff appointments in the parish." },
        new() { Key = "openRequests", Basis = "now", Definition = "Parish requests not completed, declined, withdrawn or cancelled." },
        new() { Key = "requestsReceived", Basis = "period", Definition = "Parish requests whose recorded received time falls in [from, to)." },
        new() { Key = "certificatesAwaitingBishop", Basis = "now", Definition = "Certificates waiting for the bishop's acceptance (status AwaitingBishop)." },
        new() { Key = "membershipRequestsPending", Basis = "now", Definition = "Membership requests Submitted or NeedsInformation." },
        new() { Key = "publishedEvents", Basis = "period", Definition = "Confirmed, published calendar occurrences starting in [from, to)." }
    ];

    private static readonly string[] Excluded =
    [
        "Confidential concerns, pastoral notes and incidents are not counted.",
        "Person, medical and household details are not counted or shown.",
        "Giving, budget and finance totals are not included: their report definitions (MT10-MT12) are not approved.",
        "Attendance, participation and membership-change rates are not included: their definitions (MT05, MT06, MT14) are not approved."
    ];

    public async Task<BishopOverviewDto> OverviewAsync(string archdiocese, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        await bishops.RequireBishopAsync(archdiocese, ct);
        from = Guard.Utc(from);
        to = Guard.Utc(to);
        if (to <= from || to - from > MaximumPeriod)
            throw new DomainException("invalid_period", "Give a UTC period with from before to, at most 366 days long.");
        var now = clock.GetUtcNow();
        var rows = new List<ParishOverviewDto>();
        var priests = new HashSet<string>(StringComparer.Ordinal);
        foreach (var parish in await ParishesAsync(archdiocese, ct))
        {
            var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = parish.Id };
            var staff = (await records.CollectAsync<StaffAppointment>(scope, "staffAppointment", ct, 2000)).Select(r => r.Value)
                .Where(a => a.ParishId == parish.Id && a.IsEffective(now)).ToList();
            var parishPriests = staff.Where(a => a.Role == StaffAppointmentRole.Priest).Select(a => a.AccountId).Distinct(StringComparer.Ordinal).ToList();
            priests.UnionWith(parishPriests);
            var requests = (await records.CollectAsync<ParishRequest>(scope, "parishRequest", ct, 20000)).Select(r => r.Value).ToList();
            var events = await records.CollectAsync<CalendarEvent>(scope, "event", ct, 20000, Eq("status", "Confirmed"));
            rows.Add(new ParishOverviewDto
            {
                ParishId = parish.Id, Name = parish.Name, Locality = parish.Locality, Status = parish.Status.ToString(),
                CurrentPriests = parishPriests.Count,
                HeadPriestDesignated = staff.Any(a => a.IsHead(now)),
                OtherCurrentStaff = staff.Count(a => a.Role != StaffAppointmentRole.Priest),
                OpenRequests = requests.Count(r => !RequestService.Terminal.Contains(r.Status)),
                RequestsReceived = requests.Count(r => r.ReceivedAt >= from && r.ReceivedAt < to),
                CertificatesAwaitingBishop = (await records.CollectAsync<object>(scope, "certificate", ct, 20000, Eq("status", "AwaitingBishop"))).Count,
                MembershipRequestsPending = (await records.CollectAsync<object>(scope, "membershipRequest", ct, 20000, Eq("status", "Submitted"))).Count
                    + (await records.CollectAsync<object>(scope, "membershipRequest", ct, 20000, Eq("status", "NeedsInformation"))).Count,
                PublishedEvents = events.Count(e => e.Value.Published && e.Value.StartsAt >= from && e.Value.StartsAt < to)
            });
        }
        return new BishopOverviewDto
        {
            ArchdioceseId = archdiocese, From = from, To = to, GeneratedAt = now, Ordering = "Alphabetical by parish name; parishes are not ranked.",
            Measures = Measures, Excluded = Excluded, Parishes = [.. rows],
            Totals = new OverviewTotalsDto
            {
                Parishes = rows.Count, ParishesWithoutHeadPriest = rows.Count(r => !r.HeadPriestDesignated), CurrentPriests = priests.Count,
                OtherCurrentStaff = rows.Sum(r => r.OtherCurrentStaff), OpenRequests = rows.Sum(r => r.OpenRequests), RequestsReceived = rows.Sum(r => r.RequestsReceived),
                CertificatesAwaitingBishop = rows.Sum(r => r.CertificatesAwaitingBishop), MembershipRequestsPending = rows.Sum(r => r.MembershipRequestsPending),
                PublishedEvents = rows.Sum(r => r.PublishedEvents)
            }
        };
    }

    // Only coordinates a parish manager actually recorded (with their source) are positioned; nothing is geocoded from names or localities.
    public async Task<BishopMapDto> MapAsync(string archdiocese, CancellationToken ct)
    {
        await bishops.RequireBishopAsync(archdiocese, ct);
        var entries = new List<ParishMapEntryDto>();
        foreach (var parish in await ParishesAsync(archdiocese, ct))
        {
            var location = (await records.ReadAsync<ParishLocation>(new RecordScope { Area = RecordArea.Parish, OwnerId = parish.Id }, ParishLocationService.Key, ct))?.Value;
            var recorded = location?.ParishId == parish.Id && location.IsRecorded();
            entries.Add(new ParishMapEntryDto
            {
                ParishId = parish.Id, Name = parish.Name, Locality = parish.Locality, Status = parish.Status.ToString(),
                LocationStatus = recorded ? "Recorded" : "NotRecorded",
                Latitude = recorded ? location!.Latitude : null, Longitude = recorded ? location!.Longitude : null, SourceReference = recorded ? location!.SourceReference : null
            });
        }
        return new BishopMapDto
        {
            ArchdioceseId = archdiocese, GeneratedAt = clock.GetUtcNow(), Parishes = [.. entries],
            Located = entries.Count(e => e.LocationStatus == "Recorded"), NotLocated = entries.Count(e => e.LocationStatus != "Recorded")
        };
    }

    // The parish's own recorded, bishop-accepted jurisdiction decides scope; a declared or commercial association does not.
    private async Task<List<Parish>> ParishesAsync(string archdiocese, CancellationToken ct)
    {
        var parishes = (await directory.AllAsync(ct)).Where(p => p.JurisdictionArchdioceseId == archdiocese)
            .OrderBy(p => p.Name, StringComparer.CurrentCultureIgnoreCase).ThenBy(p => p.Id, StringComparer.Ordinal).ToList();
        if (parishes.Count > MaximumParishes)
            throw new DomainException("operation_too_large", "This jurisdiction needs a bounded background report.", FailureKind.Unavailable);
        return parishes;
    }

    private static RecordCondition Eq(string path, string value) => new() { Path = path, Comparison = "eq", Value = value };
}
