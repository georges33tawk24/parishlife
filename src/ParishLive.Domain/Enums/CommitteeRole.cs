namespace ParishLive.Domain.Enums;

/// <summary>
/// A member's role inside a group — separate from their parish-level <see cref="SystemRole"/>.
/// The same person may hold different committee roles in different groups. English + Arabic display
/// names are provided via localization (CommitteeRole.* resources), incl. "Mas2oul Rouhiyet" /
/// مسؤول روحية and "Wakil Tanshi2a" / وكيل تنشئة.
/// </summary>
public enum CommitteeRole
{
    President,
    VicePresident,
    Secretary,
    Historian,
    Treasurer,
    SpiritualLeader,   // Mas2oul Rouhiyet / مسؤول روحية
    FormationRep,      // Wakil Tanshi2a / وكيل تنشئة
    CommitteeMember,
    RegularMember
}
