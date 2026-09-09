# Final cross-review — V1 source freeze consensus

Read-only. I read `docs/IMPLEMENTATION_CONTRACT.md:74-83` first, then only the four named deltas. **I ran nothing**: no `dotnet test`, no `flutter test`, no vitest, no build, no CI. The 241/45/11/105/13/63/47 counts and the 4/4-after-2-RED annotation regressions are the authors'/root's reported evidence, quoted as such, not observed by me.

## Verdict: **no blockers found in these four deltas.** They match the contract's final section.

### 1. Vehicle type catalog + migration — conforms

- Entity/config match the DTO shape and constraints: `VehicleTypeConfiguration.cs:14-18` (Code ≤80, Name ≤120, `Version` concurrency token, unique `(CompanyId, NormalizedCode)`), FK `Restrict` at `:19` — no hard deletes.
- Code immutability: `VehicleTypeService.UpdateAsync` (`:46-59`) writes only `Name`/`Active`; `Code`/`NormalizedCode` are never reassigned. Validation at `:81-91` enforces trim, 1–80/1–120 and no control characters.
- Authorization matches contract line 78: `VehicleTypeEndpoints.cs:11` authenticated own-company GET (so Supervisors can pick types), `:18,21` `PolicyAdministrator` on POST/PUT; `ListAsync` (`VehicleTypeService.cs:14`) filters `CompanyId == actor.CompanyId` and returns inactive entries too, which is what lets an edit form retain a retired value.
- Both write paths run under the shared serialization and the post-lock actor check: `VehicleTypeService.cs:64-65`, `VehicleService.cs:59-64`, `TemplateService.cs:62-70`. Resolution happens *inside* the transaction, so a type cannot be retired between check and commit.
- "Unchanged existing code stays editable after retirement" is honoured precisely: `VehicleService.cs:116-119` re-resolves only when the submitted type differs case-insensitively from the stored one; `TemplateService.cs:70` always resolves because a new version is a new assignment.
- Migration `20260909145008_VehicleTypesAndChecklistOptions.cs:56-69` backfills from both `vehicles` and `checklist_templates` per company, collapses case aliases, and touches no existing column — historical `Type`/`VehicleType` strings are left intact, and `Down` (`:73-81`) only drops what it added. Seed order matches the contract: `DevSeeder.cs:48-50` provisions types before vehicles and templates, and `:156` skips existing codes rather than reactivating retired ones. DI/mapping wired at `ServiceRegistration.cs:76` and `EndpointRegistration.cs:13`.

### 2. `allowedStatuses` — conforms, including the required-item and draft rules

- Storage: `ChecklistItemOptionsConfiguration.cs:25-40` — JSON of wire names in one nullable `varchar(200)` column, with both a `ValueConverter` and a deep `ValueComparer` (`:30-33`), so EF snapshots the list rather than the reference. NULL round-trips to NULL (`:46-52`), so pre-existing versions keep meaning "all five".
- Semantics: `Checklist.cs:44-74` — `EffectiveStatuses` resolves null to `StandardStatuses`; `Allows` consults the pinned list, never the enum.
- Write validation matches contract line 80/82 clause by clause: `TemplateService.cs:321-353` rejects empty list, undefined values, duplicates, and a required item whose only option is `NotApplicable`; `:305` applies it to every item regardless of `responseType`. Stored verbatim in submitted order at `:117-119`, frozen with the version.
- Finalization rule matches line 80's "draft autosave preserved, finalization rejects, no silent remapping": `InspectionSyncService.cs:819-831` checks `item.Allows(answer.Status)` **only** in `FinalizeAsync`, reports the allowed set, and never rewrites the value. `ApplyItems` (`:622-651`) is untouched, so draft autosave and rejected-operation bytes are preserved.
- Projection is exact: `Mapping.cs:31-35` passes `AllowedStatuses` straight through, null stays null.
- Clients implement the contract's rendering/validation clause: `mobile/lib/domain.dart:14-30` (`statusChoices`, `statusSelectionError`), used for rendering at `mobile/lib/screens/inspection.dart:650` and for pre-finalization validation at `mobile/lib/domain.dart:276-279`; admin side in `admin-web/src/pages/Templates.tsx` with `catalog-options`/`vehicle-types` test files present.

### 3. Post-lock actor/location fixes — conforms

`RequireActiveAdministratorAsync` is called immediately after `BeginCompanyWriteAsync` on the paths I checked (`VehicleService.cs:61`, `VehicleTypeService.cs:65`), and `TemplateService.cs:64` uses its editor equivalent. `VehicleService.cs:121-126` validates the effective location whenever the result is active, including a reactivation that omits `locationId`, while leaving inactive historical records editable — matching `admin-lock-followup.md:7`.

### 4. Annotation declaration exception — correct and minimal; protections intact

`InspectionSyncService.cs:768-779`. `retainedAnnotation` is true only when the declaration came from `items[].photoIds` (`declaration.ItemId is not null`, `declaration.Kind == Original`) **and** the stored row is already `Annotation`. Critically, the branch **writes nothing** — no `Kind`, `OriginalPhotoId`, bytes or links are reassigned; it only suppresses the throw. Everything else is unchanged and still enforced:

- item rebinding — `:762-766` runs before, independent of kind;
- signature ↔ item both directions — a Signature declaration has `ItemId == null` so `retainedAnnotation` is false, and an existing `Signature` is not `Annotation`, so both transitions still 409;
- signature id reused as an item photo — `:700-710`;
- foreign inspection — `:718-731`, untouched;
- duplicate photo on two items — `:689-694`.

`AnnotationSyncRegressionTests` covers exactly this surface as reported: resend-after-upload preserving `Kind`/`OriginalPhotoId`/sha/bytes in both draft and finalized variants (`:16-62`), finalize-before-upload reaching Pending→Complete with the signature keeping null `ItemId`/`OriginalPhotoId` (`:64-103`), and the four negative cases plus two upload-level rejections with `Version` still 1 and 3 stored files (`:105-166`).

## Non-blocking observations (stated, not requiring action before freeze)

- Normalization is computed two ways: `ToUpperInvariant()` in `VehicleTypeService.cs:79` for new rows, `upper(... COLLATE "pg_c_utf8")` in the backfill (`migration:63,66`). Both are simple case mappings and agree for ASCII, Latin accents and Japanese; a theoretical divergence would only make one legacy code unselectable for *new* assignments, never alter or lose history. The backfill also requires a UTF-8 database for that collation to resolve — true for the pinned PG 18 setup, and a mismatch would fail the migration loudly rather than silently.
- `VehicleTypeService.UpdateAsync` has no "last active type" guard. The contract requires that only for locations (line 47), not types, so this is by design.

## Honest limits (unchanged)

I have not observed any test run, any CI job, or any green build — all counts above are reported by their authors. No physical Galaxy Tab Active5 Pro validation exists; emulator/APK evidence does not substitute for it. No production deployment, no backup/restore, no branch protection or remote CI verification is claimed by me. Root's remaining gates stand as stated: full combined PostgreSQL suite, real E2E rerun via the actual Flutter/API runner, backup/restore, and remote CI. **My position: these four deltas are sound for source freeze; delivery remains gated on those runs.**
