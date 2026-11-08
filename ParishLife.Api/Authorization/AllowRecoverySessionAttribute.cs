// Purpose: explicitly marks an account-security action that a restricted recovery session may access.
// Main member: method-level marker consumed by RecoverySessionMiddleware; ordinary backend actions remain unavailable.

namespace ParishLife.Api.Authorization;

[AttributeUsage(AttributeTargets.Method)]
public class AllowRecoverySessionAttribute : Attribute;
