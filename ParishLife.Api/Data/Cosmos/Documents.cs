// Purpose: Defines versioned Cosmos document, audit, and idempotency envelopes and their common serialization
// settings.
// Main functions: Row, Receipt, Audit.

using System.Text.Json;
using System.Text.Json.Serialization;
using ParishLife.Api.Models;

namespace ParishLife.Api.Data.Cosmos;

public sealed record Document<T>(string Id, string PartitionKey, string Type, T Data, int SchemaVersion = 1)
{
    [JsonPropertyName("_etag")]
    public string? ETag { get; init; }
}

internal sealed record OperationReceipt(string ActorId, string Fingerprint, JsonElement Result, DateTimeOffset At);
internal sealed record AuditEntry(string ActorId, string Action, string ResourceId, string OperationId, DateTimeOffset At, string? Reason = null, string? ActingAppointmentId = null);
internal static class JsonDefaults
{
    internal static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        Converters =
        {
            new JsonStringEnumConverter()
        }
    };
    internal static Document<T> Row<T>(string id, string key, string type, T value) => new(id, key, type, value);
    internal static Document<OperationReceipt> Receipt<T>(string key, Operation op, T result) => Row("operation:" + op.Id, key, "operation", new OperationReceipt(op.ActorId, op.Fingerprint, JsonSerializer.SerializeToElement(result, Options), op.At));
    internal static Document<AuditEntry> Audit(string key, Operation op, string action, string id, string? reason = null) => Row("audit:" + op.Id, key, "audit", new AuditEntry(op.ActorId, action, id, op.Id, op.At, reason, op.ActingAppointmentId));
}
