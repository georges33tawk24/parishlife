using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using ParishLive.Application.Abstractions;

namespace ParishLive.Infrastructure.Data;

/// <summary>Design-time factory so <c>dotnet ef migrations</c> can construct the context without the web host.</summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite("Data Source=parishlive.db")
            .Options;
        return new AppDbContext(options, StaticTenantContext.None);
    }
}
