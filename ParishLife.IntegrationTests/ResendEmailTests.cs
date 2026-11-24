// Purpose: verifies the Resend email sender over real HTTP with an isolated stand-in for Resend's API.
// Main tests: with Email settings, capabilities report ProviderConfigured and a new registration gets one bilingual code email from the
// configured sender (bearer key in the header, never in the body), the code confirms the email and the account then signs in; a refusal
// by Resend is reported as not delivered; without settings nothing is sent and capabilities stay NotConfigured.

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.DependencyInjection;
using ParishLife.Api.DTOs.Accounts;
using ParishLife.Api.Services.Accounts;
using ParishLife.Api.Services.Communications;
using ParishLife.IntegrationTests.Support;
using Xunit;
using static ParishLife.IntegrationTests.Support.AuthHttp;

namespace ParishLife.IntegrationTests;

public class ResendEmailTests
{
    private const string Key = "isolated-resend-key";

    [Fact]
    public async Task Registration_code_goes_out_through_Resend_and_confirms_the_email_so_the_account_can_sign_in()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var auth = new List<string?>();
        var resend = new RoutedHandler(request =>
        {
            auth.Add(request.Headers.Authorization?.ToString());
            return Task.FromResult(RoutedHandler.Json("""{"id":"isolated-email-id"}"""));
        });
        await using var factory = Factory(f, resend);
        using var client = factory.Client();
        await Csrf(client);
        Assert.Equal("ProviderConfigured", (await Read<JsonElement>(await client.GetAsync("/api/auth/capabilities"))).GetProperty("contactVerificationDelivery").GetString());

        var email = "resend-" + Guid.NewGuid().ToString("N") + "@fixture.example";
        Assert.True((await client.PostAsJsonAsync("/api/auth/register", new { operationId = Guid.NewGuid(), email, password = Password, displayName = "New member", ageConfirmed = true })).IsSuccessStatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { username = email, password = Password })).StatusCode);
        Assert.True((await client.PostAsJsonAsync("/api/auth/contact-verification", new { email })).IsSuccessStatusCode);

        var (uri, body) = Assert.Single(resend.Requests);
        Assert.Equal(ResendEmailSender.Endpoint, uri);
        Assert.Equal("Bearer " + Key, Assert.Single(auth));
        Assert.DoesNotContain(Key, body, StringComparison.Ordinal);
        using var sent = JsonDocument.Parse(body);
        Assert.Equal("ParishLife <no-reply@parish-life.org>", sent.RootElement.GetProperty("from").GetString());
        Assert.Equal(email, Assert.Single(sent.RootElement.GetProperty("to").EnumerateArray()).GetString());
        var text = sent.RootElement.GetProperty("text").GetString()!;
        Assert.Contains("ParishLife", sent.RootElement.GetProperty("subject").GetString());
        Assert.Contains("15 minutes", text);
        Assert.Contains("١٥ دقيقة", text); // the Arabic half
        var code = Regex.Match(text, @"\b\d{6}\b").Value;
        Assert.Contains(code, sent.RootElement.GetProperty("html").GetString());

        Assert.Equal("Verified", (await Read<JsonElement>(await client.PostAsJsonAsync("/api/auth/contact-verification/confirm", new { email, code }))).GetProperty("status").GetString());
        await LoginAsync(client, email);
        Assert.True((await Read<AccountDto>(await client.GetAsync("/api/auth/me"))).EmailConfirmed);
    }

    [Fact]
    public async Task A_refusal_by_Resend_is_not_reported_as_sent_and_no_settings_means_nothing_is_sent()
    {
        await using var f = new LocalBackendFixture();
        await f.InitializeAsync();
        var refusing = new RoutedHandler(_ => Task.FromResult(RoutedHandler.Json("""{"name":"validation_error"}""", HttpStatusCode.UnprocessableEntity)));
        await using (var factory = Factory(f, refusing))
        {
            var delivery = factory.Services.CreateScope().ServiceProvider.GetRequiredService<Api.Interfaces.Services.Accounts.IContactCodeDelivery>();
            Assert.IsType<ResendContactCodeDelivery>(delivery);
            Assert.False(await delivery.SendAsync("someone@fixture.example", "123456", "ConfirmEmail", default));
            Assert.Single(refusing.Requests);
        }

        await using var unconfigured = new LocalApiFactory(f.DirectoryPath);
        Assert.IsType<UnconfiguredContactCodeDelivery>(unconfigured.Services.CreateScope().ServiceProvider.GetRequiredService<Api.Interfaces.Services.Accounts.IContactCodeDelivery>());
        using var client = unconfigured.Client();
        Assert.Equal("NotConfigured", (await Read<JsonElement>(await client.GetAsync("/api/auth/capabilities"))).GetProperty("contactVerificationDelivery").GetString());
    }

    [Fact]
    public void Change_email_message_says_so_and_both_messages_carry_only_the_code()
    {
        var (subject, text, html) = ResendContactCodeDelivery.Message("654321", "ChangeEmail");
        Assert.Contains("new", subject);
        Assert.Contains("654321", text);
        Assert.Contains("654321", html);
        Assert.Equal(2, Regex.Matches(text, "654321").Count); // once per language
        Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
    }

    private static ConfiguredApiFactory Factory(LocalBackendFixture f, RoutedHandler resend) => new(f.DirectoryPath, new()
    {
        ["Email:Provider"] = "Resend",
        ["Email:ResendApiKey"] = Key,
        ["Email:From"] = "ParishLife <no-reply@parish-life.org>"
    }, services => services.AddHttpClient(ResendEmailSender.ClientName).ConfigurePrimaryHttpMessageHandler(() => resend));
}
