using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Susumu.Infrastructure.Persistence;

/// <summary>
/// Design-time factory for <c>dotnet ef</c>. It has no fallback connection string and no embedded
/// credentials: schema tooling can modify whatever it is pointed at, so the target must always be
/// stated explicitly by the operator through SUSUMU_DB_CONNECTION.
///
/// This is a guard rail, not a guarantee. Nothing here can prove the supplied connection does not
/// point at production; that remains an operational responsibility.
/// </summary>
public sealed class SusumuDbContextFactory : IDesignTimeDbContextFactory<SusumuDbContext>
{
    public const string ConnectionVariable = "SUSUMU_DB_CONNECTION";

    public SusumuDbContext CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable(ConnectionVariable);

        if (string.IsNullOrWhiteSpace(connection))
        {
            throw new InvalidOperationException(
                $"{ConnectionVariable} is not set. EF Core design-time tooling can alter a database schema, " +
                "so it refuses to guess a target. Set it to the database you intend to change, " +
                "for example the local development database described in backend/README.md.");
        }

        var options = new DbContextOptionsBuilder<SusumuDbContext>()
            .UseNpgsql(connection, npgsql => npgsql.MigrationsAssembly(typeof(SusumuDbContext).Assembly.FullName))
            .Options;

        return new SusumuDbContext(options);
    }
}
