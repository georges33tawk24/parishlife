// Purpose: stops push notifications to one browser or phone of the caller.
// Main member: Endpoint, as the browser reported it.

using System.ComponentModel.DataAnnotations;

namespace ParishLife.Api.DTOs.Communications;

public class RemovePushDeviceDto
{
    [Required, StringLength(1000)]
    public string Endpoint { get; set; } = string.Empty;
}
