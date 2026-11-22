// Purpose: unit tests for branching business rules the other suites reach only through whole HTTP flows (Agent 09, item 1), plus the
// unit-level attack checks of item 4 and one regression of the public read cache's memory bound (03 sweep 1).
// Main tests: Guard input rules; registration money, amount due, instalment schedule, age and seat rules (the only price calculation in the
// product: offline event fees); discount and instalment validation; conditional form answers; PublicReadCache bounds, generations and
// invalidation; the rich-text sanitizer stays linear on hostile input (ReDoS); no security code draws on System.Random.

using System.Diagnostics;
using ParishLife.Api.Configuration;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Models;
using ParishLife.Api.Services.Publishing;
using ParishLife.Api.Services.Registrations;
using Xunit;

namespace ParishLife.UnitTests;

public class CoreRulesTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Guard_trims_text_and_refuses_blank_or_long_values_empty_ids_and_non_utc_instants()
    {
        Assert.Equal("Mass", Guard.Text("  Mass  ", "Title"));
        Assert.Equal("invalid_input", Assert.Throws<DomainException>(() => Guard.Text("   ", "Title")).Code);
        Assert.Equal("invalid_input", Assert.Throws<DomainException>(() => Guard.Text(null, "Title")).Code);
        Assert.Equal("invalid_input", Assert.Throws<DomainException>(() => Guard.Text(new string('a', 11), "Title", 10)).Code);
        Assert.Equal(new string('a', 10), Guard.Text(new string('a', 10) + " ", "Title", 10)); // trimmed before the length check
        Assert.Equal("invalid_id", Assert.Throws<DomainException>(() => Guard.Id(Guid.Empty)).Code);
        var id = Guid.NewGuid();
        Assert.Equal(id.ToString("N"), Guard.Id(id));
        Assert.Equal("invalid_instant", Assert.Throws<DomainException>(() => Guard.Utc(default)).Code);
        Assert.Equal("invalid_instant", Assert.Throws<DomainException>(() => Guard.Utc(new DateTimeOffset(2026, 1, 1, 9, 0, 0, TimeSpan.FromHours(2)))).Code);
        Assert.Equal(Now, Guard.Utc(Now));
    }

    [Theory]
    [InlineData("10.50", "USD", 2, true)]
    [InlineData("150000", "LBP", 0, true)]
    [InlineData("0", "USD", 2, true)]
    [InlineData("10.505", "USD", 2, false)] // more decimals than the currency's precision: no silent rounding
    [InlineData("-1", "USD", 2, false)]
    [InlineData("1000000000001", "USD", 2, false)]
    [InlineData("10", "usd", 2, false)]
    [InlineData("10", "US", 2, false)]
    [InlineData("10", "USD", 5, false)]
    public void Money_needs_an_exact_nonnegative_bounded_amount_and_a_three_letter_currency(string amount, string currency, int precision, bool valid)
    {
        var value = decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture);
        if (valid)
            RegistrationRules.Money(value, currency, precision);
        else
            Assert.Equal("invalid_money", Assert.Throws<DomainException>(() => RegistrationRules.Money(value, currency, precision)).Code);
    }

    [Fact]
    public void Amount_due_takes_the_discount_and_outstanding_takes_payments_and_refunds()
    {
        var item = new EventRegistration { Fee = 100m, DiscountAmount = 20m, Received = 50m, Refunded = 10m };
        Assert.Equal(80m, RegistrationRules.Due(item));
        Assert.Equal(40m, RegistrationRules.Outstanding(item));
        var schedule = new[]
        {
            new RegistrationInstalment { DueOn = new DateOnly(2027, 1, 1), Amount = 30m },
            new RegistrationInstalment { DueOn = new DateOnly(2027, 2, 1), Amount = 30m },
            new RegistrationInstalment { DueOn = new DateOnly(2027, 3, 1), Amount = 40m }
        };
        Assert.Equal(0m, RegistrationRules.ScheduledBy(schedule, 80m, new DateOnly(2026, 12, 31)));
        Assert.Equal(30m, RegistrationRules.ScheduledBy(schedule, 80m, new DateOnly(2027, 1, 1))); // due on the day itself
        Assert.Equal(80m, RegistrationRules.ScheduledBy(schedule, 80m, new DateOnly(2027, 3, 2))); // never more than owed after the discount
        Assert.Equal(80m, RegistrationRules.ScheduledBy([], 80m, new DateOnly(2026, 1, 1)));
    }

    [Fact]
    public void Age_turns_on_the_birthday_and_an_expired_offer_frees_its_seat()
    {
        var birth = new DateOnly(2013, 6, 15);
        Assert.Equal(12, RegistrationRules.AgeOn(birth, new DateOnly(2026, 6, 14)));
        Assert.Equal(13, RegistrationRules.AgeOn(birth, new DateOnly(2026, 6, 15)));
        Assert.Equal(12, RegistrationRules.AgeOn(new DateOnly(2012, 2, 29), new DateOnly(2025, 2, 27)));
        Assert.Equal(13, RegistrationRules.AgeOn(new DateOnly(2012, 2, 29), new DateOnly(2025, 3, 1)));

        var reserved = new EventRegistration { Status = "Reserved", OfferUntil = Now.AddMinutes(5) };
        Assert.True(RegistrationRules.ConsumesSeat(reserved, Now));
        Assert.Equal("Reserved", RegistrationRules.EffectiveStatus(reserved, Now));
        Assert.False(RegistrationRules.ConsumesSeat(reserved, Now.AddMinutes(5)));
        Assert.Equal("OfferExpired", RegistrationRules.EffectiveStatus(reserved, Now.AddMinutes(5)));
        Assert.True(RegistrationRules.ConsumesSeat(new EventRegistration { Status = "Confirmed" }, Now));
        Assert.False(RegistrationRules.ConsumesSeat(new EventRegistration { Status = "Waitlisted" }, Now));
    }

    [Fact]
    public void Discounts_and_instalments_must_fit_the_fee_exactly()
    {
        RegistrationDiscount Discount(string key, decimal amount) => new() { Key = key, Name = " Sibling ", Amount = amount };
        var kept = Assert.Single(RegistrationTermRules.Discounts([Discount("sibling", 25m)], 100m, "USD", 2));
        Assert.Equal(("Sibling", 25m), (kept.Name, kept.Amount));
        Assert.Empty(RegistrationTermRules.Discounts(null, 100m, "USD", 2));
        foreach (var bad in new[]
        {
            new[] { Discount("big", 100.01m) }, // more than the fee
            new[] { Discount("zero", 0m) },
            new[] { Discount("a", 1m), Discount("a", 2m) }, // duplicate key
            new[] { Discount("bad key", 1m) },
            new[] { Discount("cents", 1.001m) }
        })
            Assert.Throws<DomainException>(() => RegistrationTermRules.Discounts(bad, 100m, "USD", 2));

        var eventDay = new DateOnly(2027, 3, 1);
        RegistrationInstalment Part(int month, decimal amount) => new() { DueOn = new DateOnly(2027, month, 1), Amount = amount };
        Assert.Equal(2, RegistrationTermRules.Instalments([Part(1, 60m), Part(2, 40m)], 100m, "USD", 2, eventDay).Length);
        Assert.Empty(RegistrationTermRules.Instalments(null, 100m, "USD", 2, eventDay));
        foreach (var bad in new[]
        {
            new[] { Part(1, 60m), Part(2, 39.99m) }, // one cent short
            new[] { Part(2, 60m), Part(1, 40m) }, // dates out of order
            new[] { Part(1, 60m), Part(4, 40m) }, // due after the event
            new[] { Part(1, 100m), Part(2, 0m) }
        })
            Assert.Equal("invalid_instalments", Assert.Throws<DomainException>(() => RegistrationTermRules.Instalments(bad, 100m, "USD", 2, eventDay)).Code);
    }

    [Fact]
    public void Form_answers_follow_the_pinned_fields_and_their_conditions()
    {
        RegistrationField[] fields =
        [
            new() { Key = "allergy", Label = "Allergy?", Type = "Boolean", Required = true },
            new() { Key = "details", Label = "Which", Type = "Text", VisibleWhenField = "allergy", VisibleWhenValue = "true", RequiredWhenField = "allergy", RequiredWhenValue = "true" },
            new() { Key = "size", Label = "Shirt", Type = "Choice", Options = ["S", "M"] },
            new() { Key = "age", Label = "Age", Type = "Number" },
            new() { Key = "born", Label = "Born", Type = "Date" }
        ];
        RegistrationRules.ValidateFields(fields);
        string Code(Dictionary<string, string> answers) => Assert.Throws<DomainException>(() => RegistrationRules.ValidateAnswers(fields, answers)).Code;

        RegistrationRules.ValidateAnswers(fields, new Dictionary<string, string> { ["allergy"] = "false" });
        RegistrationRules.ValidateAnswers(fields, new Dictionary<string, string> { ["allergy"] = "true", ["details"] = "Nuts", ["size"] = "M", ["age"] = "12", ["born"] = "2014-05-01" });
        Assert.Equal("answer_required", Code(new() { ["size"] = "S" }));
        Assert.Equal("answer_required", Code(new() { ["allergy"] = "true" })); // required only when the condition holds
        Assert.Equal("hidden_answer", Code(new() { ["allergy"] = "false", ["details"] = "Nuts" }));
        Assert.Equal("unknown_answers", Code(new() { ["allergy"] = "false", ["isAdmin"] = "true" }));
        Assert.Equal("invalid_answer", Code(new() { ["allergy"] = "yes" }));
        Assert.Equal("invalid_answer", Code(new() { ["allergy"] = "false", ["size"] = "XL" }));
        Assert.Equal("invalid_answer", Code(new() { ["allergy"] = "false", ["age"] = "twelve" }));
        Assert.Equal("invalid_answer", Code(new() { ["allergy"] = "false", ["born"] = "01/05/2014" }));
        Assert.Equal("invalid_condition", Assert.Throws<DomainException>(() => RegistrationRules.ValidateFields(
            [new() { Key = "a", Label = "A", Type = "Text", VisibleWhenField = "later", VisibleWhenValue = "x" }])).Code);
    }

    // Regression (03 sweep 1, public cache review): replacing one key must give its bytes back, or the 32 MB bound drifts and every
    // other cached answer is thrown away after a few dozen replacements.
    [Fact]
    public void Public_read_cache_counts_a_replaced_answer_once_so_other_answers_stay()
    {
        var cache = new PublicReadCache();
        PublicReadCache.Entry Entry(int size) => new(new byte[size], "application/json", "\"e\"", cache.Generation, Now.AddMinutes(1));
        cache.Set("/api/public/parishes", Entry(10));
        for (var i = 0; i < 100; i++)
            cache.Set("/api/public/homepage", Entry(1024 * 1024)); // 100 MB written in all, 1 MB held
        Assert.True(cache.TryGet("/api/public/parishes", Now, out _));
        Assert.True(cache.TryGet("/api/public/homepage", Now, out _));
    }

    [Fact]
    public void Public_read_cache_drops_stale_generations_expired_answers_and_clears_only_on_public_writes()
    {
        var cache = new PublicReadCache();
        var stale = new PublicReadCache.Entry([1], "application/json", "\"a\"", cache.Generation, Now.AddMinutes(1));
        cache.Changed(Containers.TenantControl, "parish:x");
        cache.Set("/a", stale); // computed before the commit: not kept
        Assert.False(cache.TryGet("/a", Now, out _));

        cache.Set("/b", stale with { Generation = cache.Generation });
        cache.Changed(Containers.Catalog, "billing:x"); // not read by public pages
        Assert.True(cache.TryGet("/b", Now, out _));
        Assert.False(cache.TryGet("/b", Now.AddMinutes(1), out _)); // expired
        cache.Changed(Containers.Catalog, "platform:site-content");
        Assert.False(cache.TryGet("/b", Now, out _));
    }

    // Attack technique 7 (ReDoS): the sanitizer's patterns are non-backtracking, so hostile nesting costs linear time.
    [Fact]
    public void Rich_text_sanitizer_stays_linear_on_hostile_input()
    {
        var hostile = string.Concat(Enumerable.Repeat("<a href=\"javascript:", 4000)) + string.Concat(Enumerable.Repeat("<b><i>", 4000)) + "<";
        RichText.Sanitize("<p>warm</p>");
        var timer = Stopwatch.StartNew();
        var clean = RichText.Sanitize(hostile);
        Assert.True(timer.Elapsed < TimeSpan.FromSeconds(2), $"sanitizing took {timer.Elapsed}");
        // The unclosed tags stay visible text (encoded), never a live link.
        Assert.DoesNotContain("<a ", clean, StringComparison.Ordinal);
        Assert.StartsWith("&lt;a href=&quot;javascript:", clean, StringComparison.Ordinal);
    }

    // Attack technique 13 (predictable tokens): codes, tokens and keys come from RandomNumberGenerator; System.Random is allowed only for
    // the two non-secret uses reviewed in hardening/reports/03-security.md (visit-count sharding and retry back-off).
    [Fact]
    public void No_security_code_draws_on_System_Random()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (!File.Exists(Path.Combine(root.FullName, "ParishLife.slnx")))
            root = root.Parent ?? throw new InvalidOperationException("Repository root not found.");
        var api = Path.Combine(root.FullName, "ParishLife.Api");
        var uses = Directory.EnumerateFiles(api, "*.cs", SearchOption.AllDirectories)
            .Where(path => !path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}", StringComparison.Ordinal)
                && !path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}", StringComparison.Ordinal))
            .Where(path => File.ReadAllText(path) is var text && (text.Contains("Random.Shared", StringComparison.Ordinal) || text.Contains("new Random(", StringComparison.Ordinal)))
            .Select(path => Path.GetRelativePath(api, path).Replace('\\', '/'))
            .Order(StringComparer.Ordinal).ToArray();
        Assert.Equal(["Repositories/Reporting/SiteMetricStore.cs", "Services/Finance/GiftReceiptService.cs"], uses);
    }
}
