// Purpose: places a voice or video call in a conversation: the caller's WebRTC offer, with its network candidates already gathered.
// Main members: Video and Sdp.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Communications;

public class PlaceCallDto
{
    public bool Video { get; set; }

    [Required]
    [StringLength(20000)]
    public string Sdp { get; set; } = string.Empty;
}
