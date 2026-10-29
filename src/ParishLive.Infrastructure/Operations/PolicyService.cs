using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ParishLive.Application.Abstractions;
using ParishLive.Application.Common;
using ParishLive.Domain.Common;
using ParishLive.Domain.Entities;
using ParishLive.Domain.Enums;
using ParishLive.Infrastructure.Authorization;
using ParishLive.Infrastructure.Data;

namespace ParishLive.Infrastructure.Operations;

public sealed record PolicyInput(Guid ParishId, long Revision, string Area, string ApprovalReference,
    bool ActualApprovalConfirmed, string[] RequiredEvidence, string? RegisterSeries, string? EventLeadUserId,
    bool AllowProxyEntryApproval, bool AllowProxyCertificateApproval, Guid OperationId);

public sealed class PolicyService(AppDbContext db, ITenantContext tenant, OperationalAccess access, OperationRunner operations)
{
    public async Task<OperationResult> RecordAsync(PolicyInput input)
    {
        var roles = input.Area switch
        {
            "Religious" or "Templates" => new[] { SystemRole.Archbishop },
            "Finance" => [SystemRole.Treasurer],
            "Safeguarding" => [SystemRole.Priest],
            _ => throw new DomainException("Error.Invalid")
        };
        var grant = await access.RequireAsync(input.ParishId, roles);
        if (!input.ActualApprovalConfirmed) throw new DomainException("Error.PolicyRequired");
        Guard.Required(input.ApprovalReference, "Actual competent approval reference", 500);
        return await operations.RunAsync(input.ParishId, input.OperationId, "Policy.Record", input, async () =>
        {
            var policy = await db.ParishPolicies.SingleOrDefaultAsync(p => p.ParishId == input.ParishId);
            if (policy is null)
            {
                if (input.Revision != 0) throw new DomainException("Error.Conflict");
                policy = new ParishPolicy { OrgId = grant.OrgId, ParishId = input.ParishId };
                db.ParishPolicies.Add(policy);
            }
            else OperationRunner.Expect(policy, input.Revision);
            switch (input.Area)
            {
                case "Religious":
                    policy.RegisterSeries = Guard.Required(input.RegisterSeries, "Actual approved register series", 100);
                    policy.RequiredEvidenceJson = JsonSerializer.Serialize(input.RequiredEvidence.Select(e => Guard.Required(e, "Approved requirement", 200)).Distinct());
                    policy.AllowProxyEntryApproval = input.AllowProxyEntryApproval;
                    policy.AllowProxyCertificateApproval = input.AllowProxyCertificateApproval;
                    policy.ReligiousRequirementsApproved = true; break;
                case "Templates": policy.OfficialTemplatesApproved = true; break;
                case "Finance": policy.FinancePolicyApproved = true; break;
                case "Safeguarding":
                    var leadInput = Guard.Required(input.EventLeadUserId, "Actual designated safeguarding lead", 450);
                    var normalizedLead = leadInput.ToUpperInvariant();
                    var lead = await db.Users.SingleOrDefaultAsync(u => u.Id == leadInput || u.NormalizedUserName == normalizedLead)
                        ?? throw new DomainException("Error.AccountLookup");
                    var leaders = await db.Memberships.IgnoreQueryFilters().Where(m => m.ParishId == input.ParishId && m.UserId == lead.Id).ToListAsync();
                    if (!leaders.Any(m => m.IsEffective(DateTimeOffset.UtcNow))) throw new DomainException("Error.SafeguardingPolicy");
                    policy.SafeguardingLeadUserId = lead.Id; policy.SafeguardingPolicyApproved = true; break;
            }
            db.CaseHistories.Add(new CaseHistory { OrgId = grant.OrgId, ParishId = input.ParishId, CaseId = policy.Id,
                Action = "Policy." + input.Area, ActorUserId = access.UserId, AuthorityUserId = access.UserId,
                InternalNote = input.ApprovalReference, SnapshotJson = JsonSerializer.Serialize(policy) });
            policy.ApprovalReference = input.ApprovalReference; policy.ApprovedByUserId = access.UserId;
            policy.UpdatedAtUtc = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(); return new(policy.Id, policy.Revision);
        });
    }
}
