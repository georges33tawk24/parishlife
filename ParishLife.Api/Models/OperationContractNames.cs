// Purpose: represents operation contract names business state and rules.
// Main functions: For.

namespace ParishLife.Api.Models;

public static class OperationContractNames
{
    private static readonly IReadOnlyDictionary<Type, string> Legacy = new Dictionary<Type, string>
    {
        [typeof(global::ParishLife.Api.DTOs.Accounts.ChangePasswordDto)] = "ParishLife.Api.DTOs.Accounts.ChangePasswordRequest",
        [typeof(global::ParishLife.Api.DTOs.Accounts.CompleteMfaDto)] = "ParishLife.Api.DTOs.Accounts.CompleteMfaRequest",
        [typeof(global::ParishLife.Api.DTOs.Accounts.LoginDto)] = "ParishLife.Api.DTOs.Accounts.LoginRequest",
        [typeof(global::ParishLife.Api.DTOs.Accounts.RegisterAccountDto)] = "ParishLife.Api.DTOs.Accounts.RegisterAccountRequest",
        [typeof(global::ParishLife.Api.DTOs.Billing.CreateInvoiceDto)] = "ParishLife.Api.DTOs.Billing.CreateInvoiceRequest",
        [typeof(global::ParishLife.Api.DTOs.Billing.PublishPlanDto)] = "ParishLife.Api.DTOs.Billing.PublishPlanRequest",
        [typeof(global::ParishLife.Api.DTOs.Billing.RecordCashDto)] = "ParishLife.Api.DTOs.Billing.RecordCashRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.ApplicationActionDto)] = "ParishLife.Api.DTOs.Ministries.ApplicationActionRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.ApplyMinistryDto)] = "ParishLife.Api.DTOs.Ministries.ApplyMinistryRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.AppointLeaderDto)] = "ParishLife.Api.DTOs.Ministries.AppointLeaderRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.CreateFormationDto)] = "ParishLife.Api.DTOs.Ministries.CreateFormationRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.LinkMinistryPersonDto)] = "ParishLife.Api.DTOs.Ministries.LinkMinistryPersonRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.MinistryActionDto)] = "ParishLife.Api.DTOs.Ministries.MinistryActionRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.PrivateDepartureReasonDto)] = "ParishLife.Api.DTOs.Ministries.PrivateDepartureReasonRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.RecordAttendanceDto)] = "ParishLife.Api.DTOs.Ministries.RecordAttendanceRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.RsvpDto)] = "ParishLife.Api.DTOs.Ministries.RsvpRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.SaveMeetingDto)] = "ParishLife.Api.DTOs.Ministries.SaveMeetingRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.SaveMinistryDto)] = "ParishLife.Api.DTOs.Ministries.SaveMinistryRequest",
        [typeof(global::ParishLife.Api.DTOs.Ministries.SaveStockDto)] = "ParishLife.Api.DTOs.Ministries.SaveStockRequest",
        [typeof(global::ParishLife.Api.DTOs.Organizations.AssociationDecisionDto)] = "ParishLife.Api.DTOs.Organizations.AssociationDecisionRequest",
        [typeof(global::ParishLife.Api.DTOs.Organizations.AssociationProposalDto)] = "ParishLife.Api.DTOs.Organizations.AssociationProposalRequest",
        [typeof(global::ParishLife.Api.DTOs.Organizations.EndAssociationDto)] = "ParishLife.Api.DTOs.Organizations.EndAssociationRequest",
        [typeof(global::ParishLife.Api.DTOs.Organizations.GrantAccessDto)] = "ParishLife.Api.DTOs.Organizations.GrantAccessRequest",
        [typeof(global::ParishLife.Api.DTOs.Organizations.RegisterArchdioceseDto)] = "ParishLife.Api.DTOs.Organizations.RegisterArchdioceseRequest",
        [typeof(global::ParishLife.Api.DTOs.Organizations.RegisterParishDto)] = "ParishLife.Api.DTOs.Organizations.RegisterParishRequest",
        [typeof(global::ParishLife.Api.DTOs.Organizations.RevokeAccessDto)] = "ParishLife.Api.DTOs.Organizations.RevokeAccessRequest",
        [typeof(global::ParishLife.Api.DTOs.Organizations.VerifyParishDto)] = "ParishLife.Api.DTOs.Organizations.VerifyParishRequest",
        [typeof(global::ParishLife.Api.DTOs.People.ArchivePersonDto)] = "ParishLife.Api.DTOs.People.ArchivePersonRequest",
        [typeof(global::ParishLife.Api.DTOs.People.CreatePersonDto)] = "ParishLife.Api.DTOs.People.CreatePersonRequest",
        [typeof(global::ParishLife.Api.DTOs.Registrations.AmendParticipantDto)] = "ParishLife.Api.DTOs.Registrations.AmendParticipantRequest",
        [typeof(global::ParishLife.Api.DTOs.Registrations.ConfigureRegistrationDto)] = "ParishLife.Api.DTOs.Registrations.ConfigureRegistrationRequest",
        [typeof(global::ParishLife.Api.DTOs.Registrations.DecideEventRefundDto)] = "ParishLife.Api.DTOs.Registrations.DecideEventRefundRequest",
        [typeof(global::ParishLife.Api.DTOs.Registrations.RecordEventReceiptDto)] = "ParishLife.Api.DTOs.Registrations.RecordEventReceiptRequest",
        [typeof(global::ParishLife.Api.DTOs.Registrations.RecordPresenceDto)] = "ParishLife.Api.DTOs.Registrations.RecordPresenceRequest",
        [typeof(global::ParishLife.Api.DTOs.Registrations.RegisterParticipantDto)] = "ParishLife.Api.DTOs.Registrations.RegisterParticipantRequest",
        [typeof(global::ParishLife.Api.DTOs.Registrations.RegistrationActionDto)] = "ParishLife.Api.DTOs.Registrations.RegistrationActionRequest",
        [typeof(global::ParishLife.Api.DTOs.Registrations.RegistrationPolicyActionDto)] = "ParishLife.Api.DTOs.Registrations.RegistrationPolicyActionRequest",
        [typeof(global::ParishLife.Api.DTOs.Registrations.RequestEventRefundDto)] = "ParishLife.Api.DTOs.Registrations.RequestEventRefundRequest",
        [typeof(global::ParishLife.Api.DTOs.Registrations.ReviseFormDto)] = "ParishLife.Api.DTOs.Registrations.ReviseFormRequest",
        [typeof(global::ParishLife.Api.DTOs.Scheduling.CreateSeriesDto)] = "ParishLife.Api.DTOs.Scheduling.CreateSeriesRequest",
        [typeof(global::ParishLife.Api.DTOs.Scheduling.EventActionDto)] = "ParishLife.Api.DTOs.Scheduling.EventActionRequest",
        [typeof(global::ParishLife.Api.DTOs.Scheduling.MaintenanceDto)] = "ParishLife.Api.DTOs.Scheduling.MaintenanceRequest",
        [typeof(global::ParishLife.Api.DTOs.Scheduling.PublishMusicDto)] = "ParishLife.Api.DTOs.Scheduling.PublishMusicRequest",
        [typeof(global::ParishLife.Api.DTOs.Scheduling.ReservationActionDto)] = "ParishLife.Api.DTOs.Scheduling.ReservationActionRequest",
        [typeof(global::ParishLife.Api.DTOs.Scheduling.ReserveDto)] = "ParishLife.Api.DTOs.Scheduling.ReserveRequest",
        [typeof(global::ParishLife.Api.DTOs.Scheduling.SaveEventDto)] = "ParishLife.Api.DTOs.Scheduling.SaveEventRequest",
        [typeof(global::ParishLife.Api.DTOs.Scheduling.SaveFacilityDto)] = "ParishLife.Api.DTOs.Scheduling.SaveFacilityRequest",
        [typeof(global::ParishLife.Api.DTOs.Scheduling.SavePlanDto)] = "ParishLife.Api.DTOs.Scheduling.SavePlanRequest"
    };
    public static string? For(Type type) => Legacy.TryGetValue(type, out var name) ? name : type.FullName;
}
