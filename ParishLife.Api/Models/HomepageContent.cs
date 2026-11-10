// Purpose: the complete editable platform homepage: which sections appear, in what order, and their blocks.
// Main members: Order (section keys), Hero, Announcement, About, Join and Stories.

namespace ParishLife.Api.Models;

public class HomepageContent
{
    public string[] Order { get; set; } = [];
    public HomepageBlock? Hero { get; set; } = null;
    public HomepageBlock? Announcement { get; set; } = null;
    public HomepageBlock? About { get; set; } = null;
    public HomepageBlock? Join { get; set; } = null;
    public List<HomepageBlock> Stories { get; set; } = [];
}
