// Purpose: the text of a parish public profile (one draft or one published copy). Every field is optional and only what the parish typed; Arabic
// twins sit next to their Latin field and are never derived from it. Coordinates live in ParishLocation, photos in ParishProfilePhoto.
// Main members: NameAr, LocalityAr, Rite, RiteAr, Phone, Email, Website, Address, AddressAr, OfficeHours, OfficeHoursAr, MassTimes, MassTimesAr,
// ConfessionTimes, ConfessionTimesAr, Languages, LanguagesAr, Parking, ParkingAr, Accessibility, AccessibilityAr, Expect, ExpectAr, SacramentNotes,
// SacramentNotesAr, FeastName, FeastNameAr, FeastDate, LivestreamUrl, WhatsAppUrl and ShowClergy.

namespace ParishLife.Api.Models;

public class ParishProfileContent
{
    // The parish name in Arabic; the Latin name stays on the parish record.
    public string? NameAr { get; set; } = null;

    // The locality in Arabic; the Latin locality stays on the parish record.
    public string? LocalityAr { get; set; } = null;

    // The rite as the parish states it (free text, never inferred).
    public string? Rite { get; set; } = null;

    public string? RiteAr { get; set; } = null;

    // The parish office phone (an office number, not a personal one).
    public string? Phone { get; set; } = null;

    // The parish office email.
    public string? Email { get; set; } = null;

    // The parish's own website (HTTPS).
    public string? Website { get; set; } = null;

    public string? Address { get; set; } = null;

    public string? AddressAr { get; set; } = null;

    public string? OfficeHours { get; set; } = null;

    public string? OfficeHoursAr { get; set; } = null;

    public string? MassTimes { get; set; } = null;

    public string? MassTimesAr { get; set; } = null;

    public string? ConfessionTimes { get; set; } = null;

    public string? ConfessionTimesAr { get; set; } = null;

    // Languages and rite of the Masses, as the parish describes them.
    public string? Languages { get; set; } = null;

    public string? LanguagesAr { get; set; } = null;

    public string? Parking { get; set; } = null;

    public string? ParkingAr { get; set; } = null;

    public string? Accessibility { get; set; } = null;

    public string? AccessibilityAr { get; set; } = null;

    // What a first-time visitor should expect.
    public string? Expect { get; set; } = null;

    public string? ExpectAr { get; set; } = null;

    // What to bring for a baptism, a wedding or a certificate.
    public string? SacramentNotes { get; set; } = null;

    public string? SacramentNotesAr { get; set; } = null;

    // The parish feast's name.
    public string? FeastName { get; set; } = null;

    public string? FeastNameAr { get; set; } = null;

    // The parish feast as month-day (MM-DD).
    public string? FeastDate { get; set; } = null;

    // A livestream link the parish enters (HTTPS); nothing is fetched from it.
    public string? LivestreamUrl { get; set; } = null;

    // A WhatsApp channel or group link the parish enters (HTTPS, WhatsApp host); nothing is fetched from it.
    public string? WhatsAppUrl { get; set; } = null;

    // Whether the parish lists its clergy publicly; names come only from current accepted priest appointments, never typed here.
    public bool ShowClergy { get; set; }
}
