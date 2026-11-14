// Purpose: the text of a parish public profile, as the editor sends it and as managers and visitors read it. Arabic twins are optional and never
// filled from the Latin field; the service trims, checks links, phone, email and feast date, and stores null for empty fields.
// Main members: NameAr, LocalityAr, Rite, RiteAr, Phone, Email, Website, Address, AddressAr, OfficeHours, OfficeHoursAr, MassTimes, MassTimesAr,
// ConfessionTimes, ConfessionTimesAr, Languages, LanguagesAr, Parking, ParkingAr, Accessibility, AccessibilityAr, Expect, ExpectAr, SacramentNotes,
// SacramentNotesAr, FeastName, FeastNameAr, FeastDate, LivestreamUrl, WhatsAppUrl and ShowClergy.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Publishing;

public class ParishProfileContentDto
{
    // The parish name in Arabic; the Latin name stays on the parish record.
    [StringLength(500)]
    public string? NameAr { get; set; } = null;

    // The locality in Arabic; the Latin locality stays on the parish record.
    [StringLength(500)]
    public string? LocalityAr { get; set; } = null;

    // The rite as the parish states it (free text, never inferred).
    [StringLength(120)]
    public string? Rite { get; set; } = null;

    [StringLength(120)]
    public string? RiteAr { get; set; } = null;

    // The parish office phone (an office number, not a personal one).
    [StringLength(40)]
    public string? Phone { get; set; } = null;

    // The parish office email.
    [StringLength(254)]
    public string? Email { get; set; } = null;

    // The parish's own website (HTTPS).
    [StringLength(500)]
    public string? Website { get; set; } = null;

    [StringLength(500)]
    public string? Address { get; set; } = null;

    [StringLength(500)]
    public string? AddressAr { get; set; } = null;

    [StringLength(2000)]
    public string? OfficeHours { get; set; } = null;

    [StringLength(2000)]
    public string? OfficeHoursAr { get; set; } = null;

    [StringLength(2000)]
    public string? MassTimes { get; set; } = null;

    [StringLength(2000)]
    public string? MassTimesAr { get; set; } = null;

    [StringLength(2000)]
    public string? ConfessionTimes { get; set; } = null;

    [StringLength(2000)]
    public string? ConfessionTimesAr { get; set; } = null;

    // Languages and rite of the Masses, as the parish describes them.
    [StringLength(2000)]
    public string? Languages { get; set; } = null;

    [StringLength(2000)]
    public string? LanguagesAr { get; set; } = null;

    [StringLength(2000)]
    public string? Parking { get; set; } = null;

    [StringLength(2000)]
    public string? ParkingAr { get; set; } = null;

    [StringLength(2000)]
    public string? Accessibility { get; set; } = null;

    [StringLength(2000)]
    public string? AccessibilityAr { get; set; } = null;

    // What a first-time visitor should expect.
    [StringLength(2000)]
    public string? Expect { get; set; } = null;

    [StringLength(2000)]
    public string? ExpectAr { get; set; } = null;

    // What to bring for a baptism, a wedding or a certificate.
    [StringLength(2000)]
    public string? SacramentNotes { get; set; } = null;

    [StringLength(2000)]
    public string? SacramentNotesAr { get; set; } = null;

    // The parish feast's name.
    [StringLength(200)]
    public string? FeastName { get; set; } = null;

    [StringLength(200)]
    public string? FeastNameAr { get; set; } = null;

    // The parish feast as month-day (MM-DD).
    [StringLength(5)]
    [RegularExpression("^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$")]
    public string? FeastDate { get; set; } = null;

    // A livestream link the parish enters (HTTPS); nothing is fetched from it.
    [StringLength(500)]
    public string? LivestreamUrl { get; set; } = null;

    // A WhatsApp channel or group link the parish enters (HTTPS, WhatsApp host); nothing is fetched from it.
    [StringLength(500)]
    public string? WhatsAppUrl { get; set; } = null;

    // Whether the parish lists its clergy publicly; names come only from current accepted priest appointments, never typed here.
    public bool ShowClergy { get; set; }
}
