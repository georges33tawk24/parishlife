// Purpose: represents schedule rules business state and rules.
// Main functions: ValidatePeriod (one event, reservation or block: at most 31 days), ValidateListWindow (a paged list's date range:
// at most 366 days, so a portal load reads a ministry's meetings or the parish calendar in one request, 27 November 2026), Overlaps.

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

    public const int MaximumListDays = 366;

    public static void ValidateListWindow(DateTimeOffset start, DateTimeOffset end)
    {
        Guard.Utc(start);
        Guard.Utc(end);
        if (end <= start || end - start > TimeSpan.FromDays(MaximumListDays))
            throw new DomainException("invalid_period", "Use a positive interval of no more than " + MaximumListDays + " days.");
    }

    public static bool Overlaps(DateTimeOffset aStart, DateTimeOffset aEnd, DateTimeOffset bStart, DateTimeOffset bEnd) => aStart < bEnd && bStart < aEnd;
}
