using ParishLive.Domain.Common;
using ParishLive.Domain.Enums;

namespace ParishLive.Domain.Entities;

/// <summary>A parish group or committee (tenant-scoped). Holds many members over time.</summary>
public class Group : TenantEntity
{
    public string Name { get; set; } = string.Empty;
    public GroupCategory Category { get; set; }
    public bool IsActive { get; set; } = true;
}
