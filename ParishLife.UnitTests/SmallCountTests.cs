// Purpose: unit test for the bishop overview's small-count rule (owner decision, 23 November 2026).
// Main test: 1 to 4 are hidden (null, "fewer than 5"); 0 and 5 or more stay exact.

using ParishLife.Api.Services.Reporting;
using Xunit;

namespace ParishLife.UnitTests;

public class SmallCountTests
{
    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, null)]
    [InlineData(4, null)]
    [InlineData(5, 5)]
    [InlineData(120, 120)]
    public void Counts_of_one_to_four_are_hidden_and_others_stay_exact(int count, int? shown)
        => Assert.Equal(shown, BishopOverviewService.Shown(count));
}
