# Operations foundation

The checked-in Compose configuration is DEV-only and binds its single HTTP entry point to `127.0.0.1:8080`. The API and PostgreSQL have no host-published ports. Caddy serves the built admin application and forwards `/api/*` unchanged to the API, keeping browser requests on one origin. PostgreSQL 18 persists its versioned data beneath the `/var/lib/postgresql` parent volume. Photo originals live in a separate named volume owned by the API image's unprivileged `app` user.

## DEV startup with a Docker engine

```powershell
python scripts/generate_dev_env.py
docker compose up --build -d
```

Startup order is enforced by health probes: PostgreSQL is probed over TCP with `pg_isready`, the API image declares a `HEALTHCHECK` on `GET /health/ready` (503 while the database is unreachable), and Caddy only starts after the API is healthy, so migrations and DEV seeding finish before the first browser request. `infrastructure/api.Dockerfile` is the only API image definition; it restores NuGet packages from the project manifests before copying sources so the restore layer survives code edits.

On Linux, `bash scripts/generate-dev-env.sh` runs the same generator. It writes ignored `.env` and `.local/dev-credentials.json`, never prints secret values, and refuses to replace either file. Do not copy `.env.example` and leave blank secrets. Generated passwords use 24 random bytes each; the signing key uses 48 random bytes. On Windows, the generator protects `.local` and the empty exclusive `.env` before writing secrets: only the current user SID, SYSTEM and Administrators have access. Linux uses directory mode 0700 and secret file mode 0600. Production must use a separately reviewed identity/bootstrap process and must keep DEV seeding disabled.

Run checks with `scripts/check.ps1 -Component Infrastructure` or `bash scripts/check.sh infrastructure`. Components `Backend`, `Web`, and `Mobile` select the real test/build commands. `-BuildApk` (PowerShell) or `BUILD_DEV_APK=true` (Bash) requests a debug APK permitting explicit DEV HTTP. This artifact is named DEV in CI; production APK signing and distribution remain separate.

## Native demo on the prepared Windows computer

```powershell
./scripts/start-local.ps1
./scripts/stop-local.ps1
```

The starter uses the optional `C:\Dev\tools\SUSUMU-env.ps1` environment helper and the managed PostgreSQL 18 cluster at `.local/postgres/data` on loopback port 55432. Its existing password stays in `.local/postgres/password.txt`. It builds the Release API, installs web dependencies if missing, and launches API5080 and Vite5173 in hidden windows with logs under `.local/logs`. Open `http://127.0.0.1:5173` after readiness succeeds.

Admin username/password and the reusable JWT signing key are generated once in `.local/local-runtime-secrets.json`; no values are printed. `-PrepareOnly` generates that private file without starting services. DEV seeding receives the same admin password on every run and never resets an existing account. Other generated DEV role credentials are written separately to `.local/generated-role-credentials.json`. A changed existing admin password must be reflected in the private operator records; rerunning the seeder does not reset it.

Before reading or creating native runtime secrets/state, the scripts apply `protect-private-paths.ps1` to the project `.local` directory. It blocks broad inherited access, repairs existing child ACLs, and keeps new children inheriting the private permissions. Junctions and symbolic links are rejected before traversal. It changes no file contents and needs no administrator elevation when the operator owns the project files. A failed ACL check stops secret creation/startup. Run `./scripts/protect-private-paths.ps1` to repair an existing checkout explicitly; `-EnvFileOnly` also protects an existing root `.env` without changing its content.

`.local/local-processes.json` records PID, creation time, executable and project-specific command-line identity. Start/stop commands take an exclusive local lock. The stopper opens a native process handle before identity validation and retains that same handle for termination; it never resolves the PID again to stop API/Vite. It uses `pg_ctl` against the exact managed data directory if it owns that PostgreSQL process. An already-running managed PostgreSQL instance or project Vite server may be reused and is explicitly preserved by stop-local. Unrelated occupied ports are rejected. Databases, photos and credentials remain on disk. This convenience script expects the prepared native cluster; it does not install a new system database or configure another computer.

## Continuous integration

The GitHub Actions workflow has separate backend, web and Android jobs and a fourth Linux-container integration job. The backend job runs unit tests, PostgreSQL-specific migration/workshop tests, and a mandatory real API smoke against an ephemeral PostgreSQL 18 service. It explicitly creates `susumu_ci_tests` for schema-reset tests and supplies `TEST_DATABASE_URL` plus `SUSUMU_ALLOW_DESTRUCTIVE_TEST_DB=true` only to that test step. The API smoke receives `SUSUMU_DB_CONNECTION` for the separate, still-fresh `susumu_ci` database; this alias is not inherited by test factories.

The backend's destructive-test helper must reject connections unless the opt-in flag is true, the host is loopback, and the database name is exactly `susumu_test` or matches `susumu_ci[_suffix]`. It must never log the connection string. Do not run those tests locally until this guard is present and verified; never point them at `susumu_dev`, an existing demo, or a remote database. PostgreSQL-specific tests may be skipped by the normal local check when no explicit test database is supplied; CI supplies the isolated target so they must execute.

The container job builds all deployment images, checks Caddy's static admin page and API forwarding, runs the authenticated inspection/photo flow, recreates the containers while keeping their volumes, and verifies the finalized record and photo SHA-256 again. Its final cleanup is restricted to its unique `susumu-ci-<run>-<attempt>` project.

The PostgreSQL trust mode in the backend CI service is restricted to the disposable GitHub runner. It is not used by deployment Compose. Login and signing credentials for integration tests are generated at runtime and are never printed or uploaded. Workflow actions are pinned to verified upstream commit IDs. GitHub execution results must be checked before calling CI successful; local actionlint validates syntax only.

## Native PostgreSQL backup and restore validation

Use Python 3.11+ and PostgreSQL 18 client utilities. Set `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE` and authentication (`PGPASSWORD` only in the current process or a protected pgpass file). Never put the password on the command line or print the environment. On this Windows machine, `--pg-bin C:\Dev\tools\postgresql18\pgsql\bin` selects the portable clients.

1. Stop **all** API instances and background writers. Wait for requests to finish. Keep them stopped until the backup completion marker exists. Do not change photos, accounts or database records during this interval.
2. Run the backup, choosing a new output directory outside photo storage:

```powershell
./scripts/backup.ps1 -Photos 'C:\Dev\SusumuVehicleCheck\.local\photos' -OutputDirectory 'C:\Dev\SusumuVehicleCheck\backups\dev-20260909' -Environment Development -WritersStopped
```

```bash
bash scripts/backup.sh --photos /srv/susumu-dev/photos --output /srv/susumu-dev/backups/dev-20260909 --environment Development --writers-stopped
```

3. Confirm `sha256.json` exists and the command reports verification. It covers `database.dump`, `photos.tar.gz` and `metadata.json`. Without the final manifest, the folder is incomplete. Transfer all four files together to protected backup storage; local backup creation does not establish off-host or cloud protection.
4. Resume writers. The dump uses PostgreSQL custom format; the photo archive is captured under the same writer-stop barrier. Database and photo files remain separate, with originals preserved.
5. For a restore drill, use an explicit **new** database and a **nonexistent** photo directory in Development, Test or RestoreValidation. Existing targets are rejected; there is no drop, `--clean`, or production shortcut:

```powershell
./scripts/restore.ps1 -Bundle 'C:\Dev\SusumuVehicleCheck\backups\dev-20260909' -TargetDatabase 'susumu_restore_20260909' -TargetPhotos 'C:\Dev\SusumuVehicleCheck\.local\restore-20260909\photos' -Environment RestoreValidation
```

```bash
bash scripts/restore.sh --bundle /srv/susumu-dev/backups/dev-20260909 --target-database susumu_restore_20260909 --target-photos /srv/susumu-dev/restore-20260909/photos --environment RestoreValidation
```

Hash validation and archive path validation run before database creation. SQL restores atomically into the new database. If a subsequent file copy fails, the new database remains isolated for diagnosis; existing databases/photos are never cleaned up. Validate record counts, finalized history, audit records and photo checksums before using the restored environment. Restore is not an automatic production cutover.

## Compose backup

`scripts/backup-compose.ps1` or `bash scripts/backup-compose.sh` stops the DEV API, runs the PostgreSQL 18 backup utility with the photos volume mounted read-only, and resumes the API only if it was initially running. Caddy may serve maintenance errors while API writers are stopped. The utility persists the complete bundle under the ignored root `backups/` directory. Do not run this wrapper while another API or external writer connects to the same database.

The tool can also validate a restore into an independent database and new photo directory under `backups/`:

```bash
docker compose --profile tools run --rm --build backup restore --bundle /backups/dev-20260909 --target-database susumu_restore_20260909 --target-photos /backups/restore-20260909/photos --environment RestoreValidation
```

This does not replace the running API's database or mounted photos. Only a separately reviewed environment may be pointed at those restored targets.

## HTTPS deployment template

`compose.https.yaml` and `Caddyfile.https` are opt-in templates, not a deployment performed by this project setup. They require Docker Compose 2.24.4+ for the port override, an explicitly configured hostname/contact email, and an independent Compose project/env file. The override disables DEV seeding and enables Caddy HTTPS and HTTP-to-HTTPS redirects. Production authorization, host hardening, DNS, restore testing, monitoring and real account provisioning must precede deployment. Do not reuse the DEV project name or DEV data volumes.

## Evidence and current limits

On 2026-09-09, seven Python safety tests and PowerShell/Bash parsing passed. A real PostgreSQL 18.6 drill restored a new synthetic database and a photo into new targets; record 714 and the photo SHA-256 matched, and a repeat restore refused the existing database. Local evidence is retained in `.local/ops-validation-20260909222045/validation.json`.

Windows native start/stop/restart passed with stable admin identity and secret-file hash; the stopper preserved the independently started PostgreSQL and Vite processes (`.local/native-runtime-validation.json`). The Windows ACL regression test repaired a pre-existing broad read rule and checked both existing and newly generated files. A complete scan of 2,687 existing `.local` items found access rules only for the current SID, SYSTEM and Administrators; PostgreSQL readiness and API readiness remained successful.

The CI API runner was exercised against a separate native PostgreSQL database and its own API port. It applied migrations, seeded credentials, reached readiness, and propagated the shared smoke test's lowercase `responseType` contract failure as a nonzero exit, then stopped only its own API. This proves the runner startup/failure handling; it is not a passing application integration result. Rerun after the backend wire-contract fix using a fresh isolated `susumu_ci[_suffix]` database.

DEV Compose and its HTTPS override passed standalone Compose 5.5.1 configuration validation. Both Caddy configurations passed Caddy 2.11.4 validation. Download checksums were verified before those tools ran. No Docker engine or WSL distribution is installed on the current machine, so container image builds, Compose service startup and the Compose backup wrapper have **not** been executed locally. Native PostgreSQL backup/restore was executed successfully.
