# SUSUMU Vehicle Check — backend API

ASP.NET Core (.NET 10) + EF Core + PostgreSQL 18. Implements every `/api/v1` endpoint of
`docs/IMPLEMENTATION_CONTRACT.md`. Contract additions and open choices are recorded in
[`CONTRACT_NOTES.md`](CONTRACT_NOTES.md).

## Layout

```
backend/
  Susumu.slnx
  src/Susumu.Domain/          entities, wire DTOs, enums, AppException
  src/Susumu.Infrastructure/  EF Core context + migrations, services, security, storage, DEV seed
  src/Susumu.Api/             minimal-API host: configuration, authentication, endpoint modules
  tests/Susumu.Api.Tests/     HTTP-level tests over the real pipeline
```

The API host is deliberately thin: `Program.cs` only wires the pipeline, and each endpoint group
lives in its own file under `src/Susumu.Api/Endpoints/`.

## Requirements

- .NET 10 SDK (verified with 10.0.401; this machine has it at `C:\Dev\tools\dotnet10\dotnet.exe`).
- PostgreSQL 18 for a normal run. Not needed for `dotnet test`.
- `backend/NuGet.config` adds nuget.org, because the machine-wide NuGet config has no sources.

## Configuration

All settings can come from `appsettings*.json` or from these environment variables:

| Variable | Maps to | Notes |
| --- | --- | --- |
| `SUSUMU_JWT_SIGNING_KEY` | `Jwt:SigningKey` | **Required.** At least 32 bytes; startup fails otherwise. In Development only, a key is generated once into `.local/dev-jwt-key.txt`. |
| `SUSUMU_DB_CONNECTION` | `Database:ConnectionString` | **Required in every environment.** There is deliberately no default: the API and the EF design-time tooling must both be told which database they are talking to. |
| `SUSUMU_TRUSTED_PROXIES` | `Network:TrustedProxies` | Comma-separated proxy addresses whose `X-Forwarded-For` may be believed. Empty by default; an arbitrary forwarded header is never trusted. |
| `SUSUMU_DB_PROVIDER` | `Database:Provider` | `postgres` (default) or `sqlite` (Development/test only). |
| `SUSUMU_PHOTO_ROOT` | `PhotoStorage:RootPath` | Attachment bytes. Keep outside the repository and back it up with the database. |
| `SUSUMU_DEV_SEED` | `DevSeed:Enabled` | Synthetic fixture. Refuses to run outside Development. |
| `SUSUMU_BOOTSTRAP_ADMIN_USERNAME` / `SUSUMU_BOOTSTRAP_ADMIN_PASSWORD` | `DevSeed:AdminUsername` / `AdminPassword` | Bootstrap administrator. There is no default password anywhere. |
| `SUSUMU_DEV_SUPERVISOR_PASSWORD`, `SUSUMU_DEV_INSPECTOR_PASSWORD`, `SUSUMU_DEV_OFFICE_PASSWORD` | `DevSeed:*Password` | Optional; generated when absent. |

Other keys: `Jwt:AccessTokenLifetime` (default `12:00:00`), `Jwt:OfflineWindow` (default
`3.00:00:00`, i.e. 72 h), `PhotoStorage:MaxBytes` (default 15 MiB),
`Database:ApplyMigrationsAtStartup` (true in Development, false elsewhere),
`LoginThrottle:*` (see below), and `Susumu:IgnoreEnvironmentOverrides` — set by the automated test
hosts so a `SUSUMU_DB_CONNECTION` exported for another process cannot redirect them.

Nothing secret is committed. `.local/` is gitignored and holds the generated DEV signing key,
generated DEV passwords (`dev-credentials.json`) and the DEV attachment directory.

## Running locally

```bash
export PATH="/c/Dev/tools/dotnet10:$PATH"          # this machine
export SUSUMU_DB_CONNECTION="Host=127.0.0.1;Port=55432;Database=susumu_dev;Username=susumu_dev;Password=..."
dotnet run --project src/Susumu.Api                # http://localhost:5080, Swagger UI at /swagger
```

In Development the API applies migrations and runs the idempotent DEV seed on startup: a synthetic
company, one location, four accounts (`admin`, `supervisor`, `inspetor`, `escritorio`), vehicles
`714`, `715`, `208` and one published Portuguese truck checklist. Generated passwords are written to
`.local/dev-credentials.json`.

Without PostgreSQL you can still start the API for a client smoke test:

```bash
SUSUMU_DB_PROVIDER=sqlite SUSUMU_DB_CONNECTION="Data Source=.local/susumu-dev.db" \
  dotnet run --project src/Susumu.Api
```

## Migrations

```bash
dotnet tool install --global dotnet-ef --version 10.0.12

dotnet ef migrations add <Name> \
  --project src/Susumu.Infrastructure --startup-project src/Susumu.Api \
  --output-dir Persistence/Migrations

dotnet ef database update --project src/Susumu.Infrastructure --startup-project src/Susumu.Api
dotnet ef migrations script --idempotent --project src/Susumu.Infrastructure --startup-project src/Susumu.Api
```

Four definitive migrations exist, applied in order. Published migrations must never be rewritten:

1. `InitialSchema` — the 13 tables (`companies`, `locations`, `users`, `vehicles`,
   `checklist_templates`, `checklist_sections`, `checklist_items`, `inspections`,
   `inspection_items`, `photos`, `sync_operations`, `audit_log`, `devices`).
2. `TemplateAvailabilityAndSignature` — `checklist_templates.Active` and
   `inspections.SignaturePhotoId`, from the contract's completion clarifications.
3. `ReviewHardening` — `companies.AdministrationStamp` (the account-administration concurrency
   token) and the `employees` table with its company-scoped alternate keys.
4. `VehicleTypesAndChecklistOptions` — the company-scoped `vehicle_types` catalog, backfilled from
   existing vehicle/template codes without changing them, and nullable `checklist_items.AllowedStatuses`.
   The UTF-8 PostgreSQL18 migration uses `pg_c_utf8` for case normalization, including Latin accents.

The concurrency tokens on `vehicles.CurrentOdometerKm`, `photos.Uploaded` and `inspections.Version`
are mapping-only and change no DDL.

Schema changes are only ever made through a new migration.
The preserved initial, pre-publication DEV fixture is documented in
[`DEV_DATABASE_CONTINUITY`](../docs/DEV_DATABASE_CONTINUITY.md).

## Tests

```bash
dotnet test Susumu.slnx
```

The suite boots the real `Program` for each test against a private SQLite file and a private
attachment directory, so authentication, authorization, EF persistence and file storage are all
exercised over HTTP.

PostgreSQL coverage (migrations from scratch, the full login → 714 → draft → finalize → retry →
history flow, and the three concurrency races that a single-threaded test cannot reach) is
**destructive**: it drops and recreates its target. It therefore runs only when all three of these
hold, checked before any connection is opened:

1. `SUSUMU_ALLOW_DESTRUCTIVE_TEST_DB=true` — explicit opt-in;
2. the host is loopback (`127.0.0.1`, `localhost`, `::1`);
3. the database is deliberately named `susumu_test` or `susumu_ci[_suffix]`.

Anything else — including `susumu_dev` — is refused, and the refusal reason never echoes the
connection string. Without an approved target the tests are reported as **skipped with the reason
printed**, never as passed.

```powershell
$env:SUSUMU_ALLOW_DESTRUCTIVE_TEST_DB = 'true'
$env:TEST_DATABASE_URL = 'Host=127.0.0.1;Port=55432;Database=susumu_test;Username=susumu_dev;Password=' +
    (Get-Content -Raw '../.local/postgres/password.txt').Trim()
dotnet test Susumu.slnx
$env:TEST_DATABASE_URL = $null; $env:SUSUMU_ALLOW_DESTRUCTIVE_TEST_DB = $null
```

Read the password into the process environment; never pass it as a command argument and never print
it. CI uses its own `susumu_ci_tests` database, separate from the demo `susumu_dev`.

Final local combined suite on2026-09-09: **316 passed, 0 failed, 0 skipped**, including8 actual
PostgreSQL tests (fresh schema, concurrency, queued authorization and upgrade/backfill). Release
build completed with0 warnings/errors and no pending EF model changes. The real Node flow passed20
scenarios, followed by the Flutter/Drift/API integration test. Later CI evidence is recorded on the
delivered commit/PR; earlier review files retain the counts observed at their own timestamps.

## Login throttling policy

Two independent budgets, both in-process, both over a 15 minute window:

- **per account**: 5 failures, then that account is locked out;
- **per source address**: 50 raw failures **or** 12 distinct accounts attempted.

The source budget is wide on raw failures on purpose. Behind Caddy every tablet in the workshop
presents one address, so a narrow shared budget would let one mistyped password lock out the whole
shop; the distinct-account limit is what catches spraying and stays useful with a shared address.
Forwarded headers are honoured only for proxies listed in `Network:TrustedProxies`.

With more than one API instance each instance throttles independently — see "Known limitations".

## Initial provisioning of an empty installation

For a fresh production database, instead of enabling the DEV fixture or inserting rows by hand:

```bash
export SUSUMU_DB_CONNECTION="Host=...;Database=...;Username=...;Password=..."
export SUSUMU_JWT_SIGNING_KEY="<32+ bytes of random data>"
export SUSUMU_PROVISION_COMPANY="Susumu Sabisu"
export SUSUMU_PROVISION_LOCATION="Oficina Central"
export SUSUMU_PROVISION_ADMIN_NAME="Nome do administrador"
export SUSUMU_PROVISION_ADMIN_USERNAME="administrador"
export SUSUMU_PROVISION_ADMIN_PASSWORD="<operator-chosen password>"

dotnet run --project src/Susumu.Api -- provision
```

It applies migrations, creates one company, one location and one administrator, logs only the
resulting identifiers, and exits without starting a listener. It refuses to run if the database
already contains any user, so it cannot overwrite an account or add a back door to a running system.

**This has not been executed against any production system.** It is delivered as source and
instructions only.

## Security posture

- PBKDF2 hashes via ASP.NET Core's `PasswordHasher`; passwords are never stored or logged in clear.
- JWT (HS256) with issuer/audience/lifetime validation. Every authenticated request re-reads the
  account and compares its security stamp, so deactivation, role change and password reset revoke
  existing tokens immediately.
- Fallback authorization policy: every endpoint requires authentication unless it opts out
  (`/auth/login`, health, OpenAPI).
- Company/location scoping on every resource query. Actor, company and location are never taken from
  the request body.
- Uploads validated by content type, size, PNG/JPEG container structure and SHA-256; paths derived
  from IDs only. PNG checks include chunk CRCs and required chunks. This is bounded structural
  validation, not full pixel decoding or malware scanning; see `IMAGE_REVIEW_RESOLUTION.md`.
- All errors are ProblemDetails; unexpected exceptions are logged server-side and returned opaque.

## Known limitations

- Login throttling is per process; behind more than one instance it must move to shared state.
- Organization/employee/type administration was implemented and reviewed by the Codex worker and
  integrated with Claude's API. Final review dispositions are in `../docs/reviews/`, including
  queued authorization, effective active locations and the company-wide write lock.
- Backup and restore are infrastructure work owned by the root coordinator; the API only guarantees
  that attachment bytes live outside the database and must be backed up together with it.
- Rate limiting beyond login, observability/metrics, and refresh tokens are not implemented.
