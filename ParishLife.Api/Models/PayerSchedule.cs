// Purpose: the parish's payer schedule for subscription coverage. Without any accepted transfer the parish pays for itself.
// Main functions: LatestAccount returns the payer from the last scheduled change onward; LastChange gives that change's date;
// AccountFor returns the single payer of a whole coverage period, or null when the payer changes inside it.

namespace ParishLife.Api.Models;

public class PayerSchedule
{
    public string ParishId { get; set; } = string.Empty;

    public PayerPeriod[] Periods { get; set; } = Array.Empty<PayerPeriod>();

    public static string LatestAccount(PayerSchedule? schedule, string parishId)
        => schedule?.Periods.OrderBy(p => p.EffectiveFrom).LastOrDefault()?.BillingAccountId ?? parishId;

    public static DateTimeOffset? LastChange(PayerSchedule? schedule)
        => schedule is null || schedule.Periods.Length == 0 ? null : schedule.Periods.Max(p => p.EffectiveFrom);

    public static string? AccountFor(PayerSchedule? schedule, string parishId, DateTimeOffset start, DateTimeOffset end)
    {
        var periods = schedule?.Periods ?? [];
        if (periods.Any(p => start < p.EffectiveFrom && p.EffectiveFrom < end))
            return null;
        return periods.Where(p => p.EffectiveFrom <= start).OrderBy(p => p.EffectiveFrom).LastOrDefault()?.BillingAccountId ?? parishId;
    }
}
