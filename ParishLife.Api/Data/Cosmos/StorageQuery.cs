// Purpose: Builds allowlisted, parameterized storage filters with a matching evaluator for isolated local tests.
// Main functions: Matches, Sql, Eq, Lt, Lte, Gt, And, Or, Everything, Field, Type, All, Where, ToCosmos.

using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Azure.Cosmos;

namespace ParishLife.Api.Data.Cosmos;

internal abstract record StorageFilter
{
    internal abstract bool Matches(JsonElement document);
    internal abstract string Sql(List<object?> parameters);
    internal static StorageFilter Eq(string path, object? value) => new Comparison(path, "=", value);
    internal static StorageFilter Lt(string path, object value) => new Comparison(path, "<", value);
    internal static StorageFilter Lte(string path, object value) => new Comparison(path, "<=", value);
    internal static StorageFilter Gt(string path, object value) => new Comparison(path, ">", value);
    internal static StorageFilter And(params StorageFilter[] filters) => new Junction(true, filters);
    internal static StorageFilter Or(params StorageFilter[] filters) => new Junction(false, filters);
    // Matches every document; only the private operator snapshot enumerates whole containers.
    internal static StorageFilter Everything { get; } = new Always();
    internal static JsonElement Field(JsonElement document, string path)
    {
        foreach (var part in path.Split('.'))
            if (document.ValueKind != JsonValueKind.Object || !document.TryGetProperty(part, out document))
                return default;
        return document;
    }

    private sealed record Comparison(string Path, string Operator, object? Value) : StorageFilter
    {
        internal override bool Matches(JsonElement document)
        {
            var actual = Field(document, Path);
            var expected = JsonSerializer.SerializeToElement(Value, JsonDefaults.Options);
            if (actual.ValueKind == JsonValueKind.Undefined)
                return expected.ValueKind == JsonValueKind.Null && Operator == "=";
            int comparison;
            if (actual.ValueKind == JsonValueKind.Number && expected.ValueKind == JsonValueKind.Number)
                comparison = actual.GetDecimal().CompareTo(expected.GetDecimal());
            else if (actual.ValueKind == JsonValueKind.String && expected.ValueKind == JsonValueKind.String)
            {
                var a = actual.GetString()!;
                var b = expected.GetString()!;
                comparison = DateTimeOffset.TryParse(a, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var ad) && DateTimeOffset.TryParse(b, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var bd) ? ad.CompareTo(bd) : string.CompareOrdinal(a, b);
            }
            else
                comparison = string.CompareOrdinal(actual.GetRawText(), expected.GetRawText());
            return Operator switch
            {
                "=" => comparison == 0,
                "<" => comparison < 0,
                "<=" => comparison <= 0,
                ">" => comparison > 0,
                _ => false
            };
        }

        internal override string Sql(List<object?> parameters)
        {
            if (!Regex.IsMatch(Path, @"\A[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*\z"))
                throw new InvalidOperationException("Storage paths must be server-defined identifiers.");
            var field = "c." + Path;
            if (Value is null && Operator == "=")
                return $"(IS_NULL({field}) OR NOT IS_DEFINED({field}))";
            var name = "@p" + parameters.Count;
            parameters.Add(Value is DateTimeOffset instant ? JsonSerializer.SerializeToElement(instant, JsonDefaults.Options).GetString() : Value);
            return $"{field} {Operator} {name}";
        }
    }

    private sealed record Always : StorageFilter
    {
        internal override bool Matches(JsonElement document) => true;
        internal override string Sql(List<object?> parameters) => "true";
    }

    private sealed record Junction(bool All, StorageFilter[] Filters) : StorageFilter
    {
        internal override bool Matches(JsonElement document) => All ? Filters.All(f => f.Matches(document)) : Filters.Any(f => f.Matches(document));
        internal override string Sql(List<object?> parameters) => "(" + string.Join(All ? " AND " : " OR ", Filters.Select(f => f.Sql(parameters))) + ")";
    }
}

internal sealed record StorageQuery(StorageFilter Filter)
{
    internal static StorageQuery Type(string type) => new(StorageFilter.Eq("type", type));
    internal static StorageQuery All { get; } = new(StorageFilter.Everything);
    internal StorageQuery Where(StorageFilter filter) => new(StorageFilter.And(Filter, filter));
    internal QueryDefinition ToCosmos()
    {
        var values = new List<object?>();
        var result = new QueryDefinition("SELECT * FROM c WHERE " + Filter.Sql(values) + " ORDER BY c.id");
        for (var i = 0; i < values.Count; i++)
            result.WithParameter("@p" + i, values[i]);
        return result;
    }
}
