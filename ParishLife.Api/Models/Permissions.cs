// Purpose: represents permissions business state and rules.
// Main members: the declared named values or shared rule constants.

namespace ParishLife.Api.Models;

public static class Permissions
{
    public const string ParishManage = "parish.manage";
    public const string AccessManage = "access.manage";
    public const string BillingRead = "billing.read";
    public const string BillingManage = "billing.manage";
    public const string PeopleRead = "people.read";
    public const string PeopleWrite = "people.write";
    public const string ReportsRead = "reports.read";
    public const string ScheduleRead = "schedule.read";
    public const string ScheduleManage = "schedule.manage";
    public const string SchedulePublish = "schedule.publish";
    public const string MusicManage = "music.manage";
    public const string FacilitiesManage = "facilities.manage";
    public const string MinistriesManage = "ministries.manage";
    public const string MinistriesAttendanceRecord = "ministries.attendance.record";
    public const string MinistriesAttendanceReview = "ministries.attendance.review";
    public const string MinistriesRsvpPrivateRead = "ministries.rsvp.private.read";
    public const string MinistriesFormationRecord = "ministries.formation.record";
    public const string MinistriesFormationReview = "ministries.formation.review";
    public const string MinistriesResourcesManage = "ministries.resources.manage";
    public const string MinistriesVolunteersManage = "ministries.volunteers.manage";
    public const string RequestsManage = "requests.manage";
    public const string SacramentsRecord = "sacraments.record";
    public const string ClergyApprove = "clergy.approve";
    public const string DocumentsSign = "documents.sign";
    public const string DocumentsRelease = "documents.release";
    public const string FinanceRead = "finance.read";
    public const string FinanceEnter = "finance.enter";
    public const string FinanceApprove = "finance.approve";
    public const string FinancePost = "finance.post";
    public const string RegistrationsManage = "registrations.manage";
    public const string CheckIn = "registrations.checkin";
    public const string CommunicationsManage = "communications.manage";
    public const string PublishingManage = "publishing.manage";
    public const string WorkflowsManage = "workflows.manage";
    public const string AuditRead = "audit.read";
    public const string SettingsManage = "settings.manage";
    public const string ImportsManage = "imports.manage";
    public const string ExportsManage = "exports.manage";
    public const string IncidentsRecord = "incidents.record";
    public const string IncidentsManage = "incidents.manage";
    public const string PeopleMedicalManage = "people.medical.manage";
    public static readonly IReadOnlySet<string> SetupOwner = new HashSet<string>(StringComparer.Ordinal)
    {
        ParishManage,
        AccessManage,
        BillingRead,
        BillingManage,
        PeopleRead,
        PeopleWrite,
        ReportsRead,
        ScheduleRead,
        ScheduleManage,
        SchedulePublish,
        FacilitiesManage,
        MinistriesManage,
        RequestsManage,
        SacramentsRecord,
        DocumentsRelease,
        FinanceRead,
        FinanceEnter,
        FinanceApprove,
        FinancePost,
        RegistrationsManage,
        CheckIn,
        CommunicationsManage,
        PublishingManage,
        WorkflowsManage,
        AuditRead,
        SettingsManage,
        ImportsManage,
        ExportsManage
    };
    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        ParishManage,
        AccessManage,
        BillingRead,
        BillingManage,
        PeopleRead,
        PeopleWrite,
        ReportsRead,
        ScheduleRead,
        ScheduleManage,
        SchedulePublish,
        MusicManage,
        FacilitiesManage,
        MinistriesManage,
        MinistriesAttendanceRecord,
        MinistriesAttendanceReview,
        MinistriesRsvpPrivateRead,
        MinistriesFormationRecord,
        MinistriesFormationReview,
        MinistriesResourcesManage,
        MinistriesVolunteersManage,
        RequestsManage,
        SacramentsRecord,
        ClergyApprove,
        DocumentsSign,
        DocumentsRelease,
        FinanceRead,
        FinanceEnter,
        FinanceApprove,
        FinancePost,
        RegistrationsManage,
        CheckIn,
        CommunicationsManage,
        PublishingManage,
        WorkflowsManage,
        AuditRead,
        SettingsManage,
        ImportsManage,
        ExportsManage,
        IncidentsRecord,
        IncidentsManage,
        PeopleMedicalManage
    };
}
