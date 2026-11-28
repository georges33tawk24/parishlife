// Purpose: answers a ringing call with the callee's WebRTC answer, its network candidates already gathered.
// Main members: Sdp.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Communications;

public class AnswerCallDto
{
    [Required]
    [StringLength(20000)]
    public string Sdp { get; set; } = string.Empty;
}
