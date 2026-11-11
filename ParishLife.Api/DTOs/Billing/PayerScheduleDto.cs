// Purpose: the parish billing reader's view of who pays for future coverage; an empty schedule means the parish pays for itself.
// Main members: ParishId, CurrentAccountId (payer from the last scheduled change onward), Periods.

namespace ParishLife.Api.DTOs.Billing;

public class PayerScheduleDto
{
    public string ParishId { get; set; } = string.Empty;

    public string CurrentAccountId { get; set; } = string.Empty;

    public PayerPeriodDto[] Periods { get; set; } = Array.Empty<PayerPeriodDto>();
}
