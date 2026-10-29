using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.AspNetCore.Razor.TagHelpers;
using Microsoft.AspNetCore.WebUtilities;
using ParishLive.Application.Abstractions;

namespace ParishLive.Web.TagHelpers;

[HtmlTargetElement("a", Attributes = "href")]
[HtmlTargetElement("a", Attributes = "asp-page")]
[HtmlTargetElement("form")]
public sealed class ActingContextTagHelper(ITenantContext tenant) : TagHelper
{
    public override int Order => 1000;
    [ViewContext, HtmlAttributeNotBound] public ViewContext ViewContext { get; set; } = default!;
    public override void Process(TagHelperContext context, TagHelperOutput output)
    {
        if (tenant.ActingAssignmentId is not Guid assignment) return;
        var attribute = output.TagName == "form" ? "action" : "href";
        var target = output.Attributes[attribute]?.Value?.ToString();
        if (target is null && output.TagName == "form") target = ViewContext.HttpContext.Request.Path;
        if (target is null || !target.StartsWith('/') || target.StartsWith("//") ||
            target.StartsWith("/set-culture") || target.StartsWith("/Identity") || target.StartsWith("/Public") ||
            target.StartsWith("/Context") || QueryHelpers.ParseQuery(new Uri("http://localhost" + target).Query).ContainsKey("actingAs")) return;
        output.Attributes.SetAttribute(attribute, QueryHelpers.AddQueryString(target, "actingAs", assignment.ToString()));
    }
}
