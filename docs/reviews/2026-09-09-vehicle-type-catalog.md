# Vehicle type catalog and combined migration — 2026-09-09

The own-company catalog is available at `/api/v1/vehicle-types`: authenticated GET for all roles, Administrator-only POST/PUT. Codes are immutable and trimmed, names/activation are editable, and normalized codes have a company-specific unique index. Writes acquire the shared company transaction, revalidate the persisted administrator, and commit the record and audit together. No hard-delete route exists.

`VehicleTypeService.ResolveActiveCodeAsync` resolves an active canonical code under that transaction. Vehicle creation and type changes use it; an unchanged retired code retains its historical spelling and remains editable. Template creation uses the same resolver under its company lock, including a new version copied from a retired definition. Existing published templates and finalized inspections remain unchanged. The DEV/test fixtures provision Caminhão, Van and Truck first, and restarting the DEV seed preserves renamed or retired catalog entries.

The combined migration `20260909145008_VehicleTypesAndChecklistOptions` creates `vehicle_types`, backfills distinct existing vehicle/template codes by company, and adds nullable `checklist_items.AllowedStatuses`. Old string references are not rewritten. Existing checklist options remain NULL, meaning the standard five classifications; explicit new lists round-trip through PostgreSQL.

The first upgrade test correctly failed with an empty catalog before the backfill was added. A subsequent run exposed the portable database's C-locale ASCII-only uppercase behavior (`Caminhão` became `CAMINHãO`). The migration now explicitly uses PostgreSQL 18's `pg_c_utf8` collation for Unicode simple case mapping, independently of the database's default locale. This matches the application's invariant normalization for the tested ASCII, accented Portuguese and German sharp-s codes and requires UTF8, as used by the delivered environments. PostgreSQL documents this behavior in its [collation reference](https://www.postgresql.org/docs/18/collation.html).

Verification completed:

- 13 catalog API/service cases: authentication/roles/company scope, immutable code, case aliases, retirement/reactivation, assignment checks, historical preservation, concurrent duplicate creation, atomic audit and stale actor rejection. The first four route cases were observed failing with 404 before implementation.
- 1 seed regression ensures every synthetic reference has a catalog entry and restarting does not recreate, rename or reactivate existing entries.
- 1 guarded PostgreSQL upgrade regression builds the previous schema, inserts case aliases in two companies, upgrades, compares all original vehicle/template references, verifies normalized accented/sharp-s codes, verifies legacy NULL options and explicit options persistence, and checks no migrations remain pending.
- Catalog/seed/options/upgrade subset: **32 passed, 0 failed, 0 skipped** on `susumu_ci_catalog_upgrade20260909145205`.
- Complete backend suite: **316 passed, 0 failed, 0 skipped**, including **8 actual PostgreSQL tests**, on fresh loopback `susumu_ci_catalog_final20260909145316`. A legacy concurrent-administrator assertion was updated to include the correct post-lock 403 response and strengthened to require exactly one successful demotion and one remaining administrator.
- Final Release build: **0 warnings, 0 errors**. `dotnet ef migrations has-pending-model-changes` reports no model differences.

TRX reports are `artifacts/test-results/vehicle-types/catalog-upgrade.trx` and `catalog-full-suite.trx`; isolated test output is in ignored `.local/catalog-build`. PostgreSQL destructive tests used only explicit guarded fresh `susumu_ci_*` databases on `127.0.0.1:55432`; no demo database, production operation, backup/restore or Git operation was performed here. The coordinator owns the final demo migration and end-to-end execution.
