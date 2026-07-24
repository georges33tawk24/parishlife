using System.Net;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using ParishLive.Infrastructure.Data;
using ParishLive.Infrastructure.Identity;
using Xunit;

namespace ParishLive.IntegrationTests;

/// <summary>
/// Smoke tests: the app boots, the (authorized) dashboard renders for a signed-in user, and the Arabic
/// culture cookie flips the document to RTL with real Arabic strings.
/// </summary>
public class SmokeTests : IClassFixture<TestAppFactory>
{
    private readonly TestAppFactory _factory;

    public SmokeTests(TestAppFactory factory) => _factory = factory;

    private async Task<string> PriestIdAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return (await users.FindByEmailAsync(SeedIds.PriestAEmail))!.Id;
    }

    [Fact]
    public async Task Dashboard_returns_200_and_renders_ltr_english_by_default()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, await PriestIdAsync());

        var response = await client.GetAsync("/");
        var html = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("dir=\"ltr\"", html);
        Assert.Contains("lang=\"en\"", html);
        Assert.Contains("ParishLive", html);
        Assert.Contains("Needs your decision", html);   // localized dashboard string
    }

    [Fact]
    public async Task Arabic_culture_cookie_renders_rtl_and_arabic_strings()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, await PriestIdAsync());

        var request = new HttpRequestMessage(HttpMethod.Get, "/");
        request.Headers.Add("Cookie", ".AspNetCore.Culture=c=ar|uic=ar");
        var response = await client.SendAsync(request);
        var html = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("dir=\"rtl\"", html);
        Assert.Contains("lang=\"ar\"", html);
        Assert.Contains("بانتظار قرارك", html);          // "Needs your decision" in Arabic
    }
}
