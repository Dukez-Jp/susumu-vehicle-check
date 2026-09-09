using System.Data.Common;
using System.Net;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Susumu.Api.Tests.Infrastructure;
using Susumu.Domain;
using Susumu.Domain.Contracts;
using Susumu.Infrastructure.Persistence;
using Susumu.Infrastructure.Security;
using Susumu.Infrastructure.Services;
using Susumu.Infrastructure.Time;

namespace Susumu.Api.Tests;

[Collection(EnvironmentSensitiveCollection.Name)]
public sealed class SyncReceiptRaceTests : ApiTestBase
{
    public static IEnumerable<object[]> RaceCases()
        => new[] { "create", "update", "finalize", "changed-payload", "different-device", "different-user", "unrelated-operation" }
            .Select(mode => new object[] { mode });

    [Theory]
    [MemberData(nameof(RaceCases))]
    public async Task A_commit_after_the_receipt_miss_preserves_replay_and_conflict_semantics(string mode)
    {
        var connection = await App.WithDbAsync(db => Task.FromResult(db.Database.GetConnectionString()!));
        await RunRaceAsync(() => new DbContextOptionsBuilder<SusumuDbContext>().UseSqlite(connection), mode);
    }

    [PostgresFact]
    public async Task PostgreSQL_replays_a_commit_between_receipt_lookup_and_transaction_without_weakening_binding()
    {
        var connection = PostgresTestDatabase.RequireApprovedTarget();
        DbContextOptionsBuilder<SusumuDbContext> Options() => new DbContextOptionsBuilder<SusumuDbContext>().UseNpgsql(connection);
        await using (var target = new SusumuDbContext(Options().Options))
        {
            await target.Database.EnsureDeletedAsync();
            await target.Database.MigrateAsync();
            // Copy only this test's synthetic fixture into the explicitly guarded throwaway target.
            await App.WithDbAsync(async source =>
            {
                target.Companies.AddRange(await source.Companies.AsNoTracking().ToListAsync());
                target.Locations.AddRange(await source.Locations.AsNoTracking().ToListAsync());
                target.Users.AddRange(await source.Users.AsNoTracking().ToListAsync());
                target.Vehicles.AddRange(await source.Vehicles.AsNoTracking().ToListAsync());
                target.ChecklistTemplates.AddRange(await source.ChecklistTemplates.AsNoTracking()
                    .Include(t => t.Sections).ThenInclude(s => s.Items).ToListAsync());
            });
            await target.SaveChangesAsync();
        }
        foreach (var mode in RaceCases().Select(row => (string)row[0]))
        {
            await RunRaceAsync(Options, mode);
        }
    }

    private async Task RunRaceAsync(Func<DbContextOptionsBuilder<SusumuDbContext>> options, string mode)
    {
        var actor = new CurrentUser(Fixture.InspectorId, Fixture.CompanyId, Fixture.LocationId, UserRole.Inspector, "Inspector", "inspector");
        var payload = Inspection(Guid.NewGuid(), CompleteItems()) with { StartedAt = DateTimeOffset.UtcNow.AddMinutes(-2) };
        var existing = mode is "update" or "finalize";
        await using var winnerDb = new SusumuDbContext(options().Options);
        var winnerService = new InspectionSyncService(winnerDb, new SystemClock());
        if (existing)
        {
            await winnerService.ApplyAsync(actor, Device, Operation(Guid.NewGuid(), 0, payload), CancellationToken.None);
            payload = payload with { Notes = "New draft revision" };
        }
        if (mode == "finalize")
        {
            payload = payload with { State = InspectionState.Finalized, FinalizedAt = DateTimeOffset.UtcNow };
        }
        var request = Operation(Guid.NewGuid(), existing ? 1 : 0, payload);
        var competingRequest = mode switch
        {
            "changed-payload" => request with { Inspection = payload with { Notes = "Different immutable operation" } },
            "different-device" => request with { Inspection = payload with { DeviceId = "another-tablet" } },
            "unrelated-operation" => request with { OperationId = Guid.NewGuid() },
            _ => request,
        };
        var competingActor = mode == "different-user" ? actor with { Id = Fixture.SecondInspectorId } : actor;
        var gate = new BeforeTransactionGate();
        await using var waitingDb = new SusumuDbContext(options().AddInterceptors(gate).Options);
        var waitingService = new InspectionSyncService(waitingDb, new SystemClock());
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        var waiting = waitingService.ApplyAsync(actor, Device, request, timeout.Token);
        SyncResult committed;
        int auditCountAfterCommit;
        try
        {
            // The first receipt query has completed and returned empty. No transaction/reader is
            // held by the waiter, so the other request can commit on SQLite as well as PostgreSQL.
            await gate.Reached.WaitAsync(timeout.Token);
            Assert.False(waiting.IsCompleted);
            committed = await winnerService.ApplyAsync(competingActor, competingRequest.Inspection!.DeviceId,
                competingRequest, timeout.Token);
            Assert.False(committed.Replayed);
            Assert.True(await winnerDb.SyncOperations.AsNoTracking()
                .AnyAsync(r => r.OperationId == competingRequest.OperationId, timeout.Token));
            auditCountAfterCommit = await winnerDb.AuditEntries.CountAsync(a => a.InspectionId == payload.Id, timeout.Token);
        }
        finally
        {
            gate.Release();
        }

        if (mode is "create" or "update" or "finalize")
        {
            var replay = await waiting;
            Assert.True(replay.Replayed);
            Assert.Equal(committed.Response, replay.Response);
        }
        else
        {
            var rejected = await Assert.ThrowsAsync<AppException>(() => waiting);
            Assert.Equal((int)(mode == "different-user" ? HttpStatusCode.Forbidden : HttpStatusCode.Conflict), rejected.Status);
        }
        Assert.Null(waitingDb.Database.CurrentTransaction);
        await using var check = new SusumuDbContext(options().Options);
        Assert.Equal(existing ? 2 : 1, await check.SyncOperations.CountAsync(r => r.InspectionId == payload.Id));
        var stored = await check.Inspections.AsNoTracking().SingleAsync(i => i.Id == payload.Id);
        Assert.Equal(existing ? 2 : 1, stored.Version);
        Assert.Equal(competingRequest.Inspection!.Notes, stored.Notes);
        Assert.Equal(auditCountAfterCommit, await check.AuditEntries.CountAsync(a => a.InspectionId == payload.Id));
    }

    private sealed class BeforeTransactionGate : DbTransactionInterceptor
    {
        private readonly TaskCompletionSource _reached = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource _released = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private int _entered;
        public Task Reached => _reached.Task;
        public void Release() => _released.TrySetResult();

        public override async ValueTask<InterceptionResult<DbTransaction>> TransactionStartingAsync(
            DbConnection connection, TransactionStartingEventData eventData,
            InterceptionResult<DbTransaction> result, CancellationToken cancellationToken = default)
        {
            if (Interlocked.Exchange(ref _entered, 1) == 0)
            {
                _reached.TrySetResult();
                await _released.Task.WaitAsync(cancellationToken);
            }
            return result;
        }
    }
}
