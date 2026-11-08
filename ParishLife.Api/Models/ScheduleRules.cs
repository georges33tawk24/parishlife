// Purpose: represents schedule rules business state and rules.
// Main functions: ValidatePeriod, Overlaps.

namespace ParishLife.Api.Models;

public static class ScheduleRules
{
    public static void ValidatePeriod(DateTimeOffset start, DateTimeOffset end)
    {
        Guard.Utc(start);
        Guard.Utc(end);
        if (end <= start || end - start > TimeSpan.FromDays(31))
            throw new DomainException("invalid_period", "Use a positive interval of no more than 31 days.");
    }

    public static bool Overlaps(DateTimeOffset aStart, DateTimeOffset aEnd, DateTimeOffset bStart, DateTimeOffset bEnd) => aStart < bEnd && bStart < aEnd;
}
