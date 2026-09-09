# Administrative lock follow-up — 2026-09-09

Two confirmed gaps from the independent review are resolved in UserAdminService and VehicleService. The original Claude review record is unchanged.

Every create/update path now calls the shared `OrganizationAdministrationService.RequireActiveAdministratorAsync(db, actor, ct)` immediately after acquiring the company write transaction. The check reads the persisted account, Administrator role, active company and active same-company location. A request that authenticated before waiting cannot commit after another administrator demotes or disables that actor. The organization service uses the same check.

Default creation locations now pass through the database validation even when `locationId` is omitted. User reactivation validates the persisted location; vehicle updates validate the effective existing/new location whenever the resulting vehicle is active. Invalid reactivation returns 400 without a mutation or success audit. Inactive historical records remain editable without being reactivated.

Exactly one literal NUL in `ReviewRegressionTests.cs` was replaced with the C# textual `\0` escape, preserving the runtime string used to test CSV formula escaping. A subsequent byte scan found no literal NUL.

## Verification

- Before the service changes, all 20 new SQLite regression cases failed: four mutation paths against role/account/company/location revocation, omitted stale default locations, and reactivation in a closed location.
- After the changes, all 20 passed. The reactivation tests also verify no extra audit and that inactive historical records remain editable.
- A new PostgreSQL regression tests all four mutation paths against both role demotion and account deactivation. For each case, it holds the company lock, starts the other request, observes PostgreSQL `pg_stat_activity.wait_event_type = 'Lock'` for that request's backend PID, then commits the revocation. All eight waits were observed and all eight writes returned 403, with no audit or extra resource committed. Polling has a timeout but success depends on the observed database lock, not elapsed time.
- The complete suite passed **241 tests, 0 failed, 0 skipped**, including **7 actual PostgreSQL tests** (the previous six plus the new lock regression). SQLite API coverage, including the 29 organization cases, ran in the same suite.
- `dotnet build backend/Susumu.slnx -c Release --no-restore` passed with 0 warnings and 0 errors; the Release API is ready for the coordinator's `start-local.ps1 -SkipBuild`.
- Standalone lock test used fresh `susumu_ci_adminfollowup20260909143614`; the complete suite used fresh `susumu_ci_adminsuite20260909143719`, both on loopback port 55432. The guarded destructive tests were explicitly enabled only for these throwaway targets. `susumu_dev` was never a test target. Credentials were read only into the child process environment and were not printed.

Reports: `artifacts/test-results/admin-lock/admin-lock-postgres.trx` and `artifacts/test-results/admin-lock/admin-lock-full-suite.trx`. The isolated test build is under ignored `.local/admin-lock-build`.

Later catalog/options integration reran the entire suite successfully: 316 passed, 0 failed, 0 skipped, including 8 PostgreSQL tests. The older concurrent peer-demotion test could now observe the intentional post-lock 403 response; its accepted revocation outcomes include 401/403/409 and it requires exactly one successful demotion and one remaining administrator. The deterministic eight-wait lock regression remains unchanged. See `2026-09-09-vehicle-type-catalog.md` for that later run and its safe target.

The demo API remained stopped during this work. No backup, restore, production operation, or Git operation was performed.
