namespace Susumu.Api.Tests.Infrastructure;

/// <summary>
/// Tests that read or temporarily set process-wide environment variables. Environment variables are
/// shared by the whole test process, so these must not run beside anything that reads them —
/// notably the PostgreSQL tests, which resolve their target from <c>TEST_DATABASE_URL</c>.
/// </summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class EnvironmentSensitiveCollection
{
    public const string Name = "environment-sensitive";
}
