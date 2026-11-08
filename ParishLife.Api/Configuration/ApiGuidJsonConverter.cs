// Purpose: accepts the compact GUIDs returned by existing API records as well as standard hyphenated GUID input.
// Main functions: Read, Write.

using System.Text.Json;
using System.Text.Json.Serialization;

namespace ParishLife.Api.Configuration;

internal sealed class ApiGuidJsonConverter : JsonConverter<Guid>
{
    public override Guid Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String && reader.GetString() is { Length: 32 or 36 } value && (Guid.TryParseExact(value, "N", out var id) || Guid.TryParseExact(value, "D", out id)))
            return id;
        throw new JsonException("A GUID in compact or hyphenated format is required.");
    }

    public override void Write(Utf8JsonWriter writer, Guid value, JsonSerializerOptions options) => writer.WriteStringValue(value);
}
