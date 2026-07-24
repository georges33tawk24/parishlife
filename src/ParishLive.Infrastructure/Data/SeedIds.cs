namespace ParishLive.Infrastructure.Data;

/// <summary>Fixed identifiers for the demo seed so tests can reference them deterministically.</summary>
public static class SeedIds
{
    public static readonly Guid Org = Guid.Parse("00000000-0000-0000-0000-0000000000a0");
    public static readonly Guid ParishA = Guid.Parse("00000000-0000-0000-0000-0000000000a1");
    public static readonly Guid ParishB = Guid.Parse("00000000-0000-0000-0000-0000000000a2");

    // Phase 2 groups (Parish A)
    public static readonly Guid YouthGroup = Guid.Parse("00000000-0000-0000-0000-0000000000b1");
    public static readonly Guid Choir = Guid.Parse("00000000-0000-0000-0000-0000000000b2");
    public static readonly Guid FundraisingCommittee = Guid.Parse("00000000-0000-0000-0000-0000000000b3");

    public const string PriestAEmail = "priest.a@parishlive.test";
    public const string PriestBEmail = "priest.b@parishlive.test";
    public const string SecretaryAEmail = "secretary.a@parishlive.test";
    public const string RitaEmail = "rita.khoury@parishlive.test";  // the multi-role member
    public const string DemoPassword = "Passw0rd!";
}
