# Configurable answer options on checklist items — implementation review

Scope closed: the master V1 requirement for configurable allowed answer options on checklist items,
plus the template-creation half of the vehicle type catalog integration. Backend only; no migration
was generated or applied here (see *Migration handover*).

## What changed

| File | Change |
| --- | --- |
| `src/Susumu.Domain/Contracts/Dtos.cs` | `ChecklistItemDto` and `ChecklistItemWriteDto` gain a trailing optional `AllowedStatuses` (`ItemStatus[]?`, default `null`). |
| `src/Susumu.Domain/Entities/Checklist.cs` | `ChecklistItem.AllowedStatuses`, the `StandardStatuses` list, and the non-persisted `EffectiveStatuses` / `Allows(status)` helpers. |
| `src/Susumu.Infrastructure/Persistence/ChecklistItemOptionsConfiguration.cs` (new) | Value conversion + deep `ValueComparer` storing the list as a JSON array of wire names in one nullable column. |
| `src/Susumu.Infrastructure/Services/TemplateService.cs` | Option validation; options stored verbatim on the new version; company write transaction, persisted-actor re-read and active catalog resolution around `CreateVersionAsync`. |
| `src/Susumu.Infrastructure/Services/Mapping.cs` | Projects the stored options into the DTO unchanged. |
| `src/Susumu.Infrastructure/Services/InspectionSyncService.cs` | Finalization rejects an answer outside the item's pinned options. |
| `tests/Susumu.Api.Tests/ChecklistOptionsTests.cs` (new) | 11 tests, described below. |

## Behaviour

**Default is null, not a rewritten list.** An omitted or null `allowedStatuses` means the five
standard statuses. Nothing is backfilled: rows written before this feature keep `NULL` in the
database and `null` on the wire, through create, `GET /templates`, `GET /templates/{id}` and
`/bootstrap`. A cached client that predates the field is unaffected, and an explicit list is never
invented for a decision nobody made.

**An explicit list is validated, then frozen verbatim.** It must be non-empty, contain only defined
`ItemStatus` values, and contain no duplicates; a *required* item must offer at least one option
other than `NotApplicable`, otherwise it could never be answered. Options apply to measurement items
too, because a measurement still carries a status. The submitted order is preserved exactly — the
clients render it — and no value is normalised, reordered or remapped. Options live on the item row
of one template version, and publishing already freezes the version, so a later version of the same
family cannot change the rules an inspection was pinned to.

**Empty list is rejected rather than treated as "all".** `[]` would otherwise be an item with no
possible answer, and "all options" already has a spelling: omit the field.

**A value outside the classification is rejected at the edge.** `allowedStatuses: ["Amarelo"]` fails
in the JSON layer (`allowIntegerValues: false`, no numeric or unknown enum names), so arbitrary
labels that would destroy reporting semantics never reach the service. The service repeats the
`Enum.IsDefined` check for non-HTTP callers.

**Finalization enforces, draft autosave does not.** The check runs only on the transition to
`Finalized`. A draft keeps whatever the tablet holds — including the initial `NotApplicable`
placeholder on an item that does not offer it — so offline field work is never lost to this rule.
On finalization a disallowed answer produces `400` with `items.{itemId}.status` naming the value and
the allowed set; it is never silently remapped to a neighbouring status. The rejection happens before
`SaveChanges`, so the transaction rolls back, no sync receipt is written and the same `operationId`
can carry the corrected answer (covered by a test).

**Frozen hashing untouched.** `CanonicalPayload` and the idempotency hash were not modified: the
options live on the template, not in the inspection payload.

## Vehicle type catalog integration (`CreateVersionAsync`)

`CreateVersionAsync` now: validates the payload → opens
`OrganizationAdministrationService.BeginCompanyWriteAsync(db, companyId, ct)` → re-reads the
persisted actor under the lock, requiring an **active Administrator or Supervisor** with an active
company and location → resolves the vehicle type through
`VehicleTypeService.ResolveActiveCodeAsync(db, companyId, code, ct)` (the catalog owner's helper,
used as published, not duplicated) → reads the version counter → inserts the version and the audit
row → `SaveChanges` + `Commit` in that one transaction.

Consequences, all covered by tests: a new version requires an active catalog type and stores the
catalog's canonical spelling; a role revoked while the request waited for the lock cannot create a
version even though its token is still valid; publication, retirement (`SetAvailabilityAsync`) and
reading existing definitions, history and templates whose type was later retired are unchanged, and
inspections pinned to such a version keep syncing and finalizing.

## Tests — `dotnet test --filter FullyQualifiedName~ChecklistOptionsTests`

11 tests, all passing (`.local/options-build` artifacts path, SQLite via `EnsureCreated`):

1. `An_item_without_configured_options_stays_null_and_still_accepts_every_standard_status`
2. `Configured_options_round_trip_verbatim_through_create_get_and_bootstrap`
3. `An_empty_option_list_is_rejected`
4. `A_repeated_option_is_rejected`
5. `An_option_outside_the_standard_classification_is_rejected` (raw JSON)
6. `A_required_item_cannot_offer_only_NotApplicable` (and the same list is accepted when optional)
7. `Finalizing_with_an_option_the_item_does_not_offer_is_rejected_and_leaves_the_operation_reusable`
8. `A_draft_keeps_the_NotApplicable_placeholder_that_finalization_would_refuse`
9. `Each_template_version_is_validated_against_the_options_it_was_published_with`
10. `A_new_version_needs_an_active_catalog_type_while_published_ones_stay_readable`
11. `A_role_revoked_while_the_request_waited_for_the_company_lock_cannot_create_a_version`

Red state was verified rather than assumed: with the finalization rule disabled, tests 7, 8 and 9
fail; with the option validation and the DTO projection disabled, tests 2, 3, 4 and 6 fail. Both
probes were reverted and the suite re-run green.

Regression check on the neighbouring classes (`TemplateTests`, `SyncTests`,
`SignatureAndAvailabilityTests`, `ReviewRegressionTests`, `DevSeedTests`, `ReportingTests`,
`VehicleTypeCatalogTests`, `VehicleAndUserTests` + the new class): **105 passing, 0 failing**.

## Migration handover

`.local/checklist-options-model-ready.txt` records that the model is stable. One nullable column is
added by this work:

- table `checklist_items`, column `AllowedStatuses`, `varchar(200)` (`HasMaxLength(200)`), **nullable**,
  no default, no index, no backfill — existing rows must stay `NULL`.

Values are a JSON array of the wire names, e.g. `["OK","Repair"]`. Nothing else in the model was
touched by this worker.

## Limitations, honestly

- No migration was generated or applied, and no PostgreSQL run was performed here; the column above
  exists so far only in the EF model and in the SQLite schema that `EnsureCreated` builds for tests.
  The combined migration and the PostgreSQL/integration verification are the coordinator's step.
- The full API suite was not run by this worker (root runs the combined checks); the 105 tests above
  are the subset that touches templates, sync, seeding, reporting and the vehicle type catalog.
- Mobile and web are outside this worker's ownership. The server contract is in place and
  backward compatible, but the admin option checkboxes and the mobile "render only allowed choices"
  rendering are the client workers' scope and were not verified here.
- `ResolveActiveCodeAsync` reports its validation error under the field key `code`. On
  `POST /templates` the natural key would be `vehicleType`. The message is unambiguous
  ("Select an active vehicle type in your company.") and the helper is not this worker's to change,
  so it is propagated as published; re-keying it is a one-line follow-up for root if the admin form
  needs field-level highlighting.
- A `ValueComparer` is configured, so replacing the list is tracked correctly; mutating a returned
  list in place is not a supported operation and no code does it.
