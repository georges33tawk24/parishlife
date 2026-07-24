using ParishLive.Domain.Enums;
using Xunit;

namespace ParishLive.IntegrationTests;

public class ReservationStatusTests
{
    [Fact]
    public void Workflow_defines_the_secretary_and_priest_handoff_states()
    {
        Assert.True(Enum.IsDefined(ReservationStatus.UnderSecretaryReview));
        Assert.True(Enum.IsDefined(ReservationStatus.ForwardedToPriest));
        Assert.True(Enum.IsDefined(ReservationStatus.Approved));
        Assert.True(Enum.IsDefined(ReservationStatus.Rejected));
    }
}
