// Purpose: verifies preserved retry fingerprints and real local pagination after the MiniDevOps class migration.
// Main tests: Renamed_dtos_preserve_the_previous_request_fingerprint and
// Cursor_scope_is_compared_by_values_and_cannot_be_reused_for_another_tenant_or_query.

using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using ParishLife.Api.Data.Cosmos;
using ParishLife.Api.Data.Local;
using ParishLife.Api.DTOs.Organizations;
using ParishLife.Api.Models;
using ParishLife.Api.Models.Enums;
using ParishLife.Api.Repositories.Common;
using Xunit;

namespace ParishLife.IntegrationTests;

public class DtoMigrationTests
{
    [Fact]
    public void Renamed_dtos_preserve_the_previous_request_fingerprint()
    {
        var id = Guid.Parse("12121212-3434-5656-7878-909090909090");
        var request = new RegisterParishDto
        {
            OperationId = id,
            Name = "Isolated fixture",
            Locality = "Fixture locality",
            Contact = "Fixture office",
            DeclaredArchdiocese = null
        };
        const string previousJson = "{\"OperationId\":\"12121212-3434-5656-7878-909090909090\",\"Name\":\"Isolated fixture\",\"Locality\":\"Fixture locality\",\"Contact\":\"Fixture office\",\"DeclaredArchdiocese\":null}";
        var previousPayload = "fixture-actor\nParishLife.Api.DTOs.Organizations.RegisterParishRequest\n\n" + previousJson;
        var expected = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(previousPayload)));

        Assert.Equal(expected, Operation.Create(id, "fixture-actor", request, TimeProvider.System).Fingerprint);
        request.Contact = "Changed fixture office";
        Assert.NotEqual(expected, Operation.Create(id, "fixture-actor", request, TimeProvider.System).Fingerprint);
    }

    [Fact]
    public async Task Cursor_scope_is_compared_by_values_and_cannot_be_reused_for_another_tenant_or_query()
    {
        var directory = Path.Combine(Path.GetTempPath(), "ParishLife-Cursor-" + Guid.NewGuid().ToString("N"));
        try
        {
            var records = new RecordTransactions(new PartitionDocuments(new LocalDocumentDatabase(directory)), new EphemeralDataProtectionProvider());
            var parish = Guid.NewGuid().ToString("N");
            var scope = new RecordScope { Area = RecordArea.Parish, OwnerId = parish };
            var operation = Operation.Create(Guid.NewGuid(), "fixture-actor", new { command = "fixture" }, TimeProvider.System);
            await records.CommitAsync(scope, operation, "fixture.create", parish,
                [RecordChange.Create("person:a", "person", new Person { Id = "a", ParishId = parish }),
                 RecordChange.Create("person:b", "person", new Person { Id = "b", ParishId = parish })],
                new CommandResult { Id = parish, Status = "Fixture" }, default);

            var first = await records.PageAsync<Person>(scope, "person", 1, null, default);
            Assert.Equal("a", Assert.Single(first.Items).Value.Id);
            Assert.NotNull(first.ContinuationToken);
            var next = await records.PageAsync<Person>(new RecordScope { Area = RecordArea.Parish, OwnerId = parish }, "person", 1, first.ContinuationToken, default);
            Assert.Equal("b", Assert.Single(next.Items).Value.Id);
            Assert.Null(next.ContinuationToken);

            var wrongTenant = await Assert.ThrowsAsync<DomainException>(() => records.PageAsync<Person>(new RecordScope { Area = RecordArea.Parish, OwnerId = "other-fixture" }, "person", 1, first.ContinuationToken, default));
            Assert.Equal("invalid_cursor", wrongTenant.Code);
            var wrongSize = await Assert.ThrowsAsync<DomainException>(() => records.PageAsync<Person>(scope, "person", 2, first.ContinuationToken, default));
            Assert.Equal("invalid_cursor", wrongSize.Code);
            var wrongQuery = await Assert.ThrowsAsync<DomainException>(() => records.PageAsync<Person>(scope, "person", 1, first.ContinuationToken, default, new RecordCondition { Path = "archived", Comparison = "eq", Value = false }));
            Assert.Equal("invalid_cursor", wrongQuery.Code);
        }
        finally
        {
            Assert.StartsWith(Path.GetFullPath(Path.GetTempPath()), Path.GetFullPath(directory), StringComparison.OrdinalIgnoreCase);
            if (Directory.Exists(directory))
                Directory.Delete(directory, true);
        }
    }
}
