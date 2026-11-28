// Purpose: aggregate sign-in account figures for the Super Admin insights page; counts only, never names, emails or credentials.
// Main members: Total, Active, Suspended, Pending, WithAuthenticator, WithGoogleOrMicrosoft and CreatedByDay (accounts created on each day of the period).

namespace ParishLife.Api.DTOs.Reporting;

public class AccountTotalsDto
{
    public int Total { get; set; }

    public int Active { get; set; }

    public int Suspended { get; set; }

    public int Pending { get; set; }

    public int WithAuthenticator { get; set; }

    public int WithGoogleOrMicrosoft { get; set; }

    public DayCountDto[] CreatedByDay { get; set; } = Array.Empty<DayCountDto>();
}
