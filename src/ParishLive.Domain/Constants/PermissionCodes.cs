namespace ParishLive.Domain.Constants;

/// <summary>
/// Centralised catalogue of authorizable actions (verbs × resources). Configurable RBAC maps these
/// to roles via role_permissions. Adopted from the ParishLife reference and aligned to our spec.
/// </summary>
public static class PermissionCodes
{
    public static class Members
    {
        public const string View = "members.view";
        public const string Manage = "members.manage";
        public const string AssignRoles = "members.assign_roles";
    }

    public static class Groups
    {
        public const string View = "groups.view";
        public const string Manage = "groups.manage";
    }

    public static class Reservations
    {
        public const string Create = "reservations.create";
        public const string View = "reservations.view";
        public const string Review = "reservations.review";   // secretary
        public const string Approve = "reservations.approve"; // priest
        public const string Manage = "reservations.manage";
    }

    public static class Events
    {
        public const string View = "events.view";
        public const string Manage = "events.manage";
        public const string Register = "events.register";
    }

    public static class Notices
    {
        public const string View = "notices.view";
        public const string Publish = "notices.publish";
    }

    public static class Reports
    {
        public const string View = "reports.view";
        public const string Export = "reports.export";
    }

    public static class Audit
    {
        public const string View = "audit.view";
    }
}
