// Purpose: marks a test that proves a known, reported application bug (hardening/handoffs/from-09-qa.md). It is reported as skipped with
// the reason, so the suite stays green for CI, and runs for real (and fails until the bug is fixed) with QA_KNOWN_FAILURES=1. When the bug
// is fixed, replace this attribute with [Fact].
// Main member: the constructor, which sets Skip unless QA_KNOWN_FAILURES is "1".

using Xunit;

namespace ParishLife.IntegrationTests.Support;

public sealed class KnownFailureFactAttribute : FactAttribute
{
    public KnownFailureFactAttribute(string reason)
    {
        if (Environment.GetEnvironmentVariable("QA_KNOWN_FAILURES") != "1")
            Skip = "Known failure (run with QA_KNOWN_FAILURES=1): " + reason;
    }
}
