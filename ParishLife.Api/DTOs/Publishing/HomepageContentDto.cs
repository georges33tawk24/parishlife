// Purpose: the complete editable platform homepage in a request or response.
// Main members: Order, Hero, Announcement, About, Join and Stories.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Publishing;

public class HomepageContentDto
{
    [Required, MaxLength(5)]
    public string[] Order { get; set; } = [];

    public HomepageBlockDto? Hero { get; set; } = null;
    public HomepageBlockDto? Announcement { get; set; } = null;
    public HomepageBlockDto? About { get; set; } = null;
    public HomepageBlockDto? Join { get; set; } = null;

    [MaxLength(50)]
    public List<HomepageBlockDto> Stories { get; set; } = [];
}
