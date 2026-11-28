// Purpose: verifies the two schedule period rules: one event, reservation or block lasts at most 31 days, while a paged list may cover
// up to 366 days so a portal load reads a ministry's meetings or the calendar in one request (27 November 2026).
// Main tests: A_list_window_takes_up_to_366_days_but_one_period_stays_at_31.

using ParishLife.Api.Models;
using Xunit;

namespace ParishLife.UnitTests;

public class ScheduleRulesTests
{
    [Fact]
    public void A_list_window_takes_up_to_366_days_but_one_period_stays_at_31()
    {
        var start = new DateTimeOffset(2026, 11, 27, 0, 0, 0, TimeSpan.Zero);
        ScheduleRules.ValidateListWindow(start, start.AddDays(366));
        ScheduleRules.ValidatePeriod(start, start.AddDays(31));
        Assert.Equal("invalid_period", Assert.Throws<DomainException>(() => ScheduleRules.ValidateListWindow(start, start.AddDays(367))).Code);
        Assert.Equal("invalid_period", Assert.Throws<DomainException>(() => ScheduleRules.ValidateListWindow(start, start)).Code);
        Assert.Equal("invalid_period", Assert.Throws<DomainException>(() => ScheduleRules.ValidatePeriod(start, start.AddDays(32))).Code);
    }
}
