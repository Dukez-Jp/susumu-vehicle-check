# Backend resolution of the integration review

Source: `docs/INTEGRATION_REVIEW.md` (28 numbered findings plus the stale-admin-odometer note and the
CI/test-guard coordination note) and `docs/reviews/2026-09-09-claude-clients.md` (client review items
that land on the API).

Every item was re-read against the **current** source, not the intermediate state the reviewers saw.
Each row says what the code does now and names the test that would catch a regression.

Evidence for the whole file, `dotnet test Susumu.slnx`:

- **220 passed, 0 failed, 0 skipped** with `TEST_DATABASE_URL` pointing at the loopback throwaway
  `susumu_test` and `SUSUMU_ALLOW_DESTRUCTIVE_TEST_DB=true` — the six PostgreSQL tests really
  executed. Run twice, both green, to check the three concurrency races are stable and not flaky.
- **214 passed, 0 failed, 6 skipped** without those variables; the six report the guard's reason.
- `susumu_dev` was verified intact afterwards (3 vehicles, 4 users, 1 template). The guard refuses
  that name, so the destructive tests can never reach it.

## Blocker first

| # | Finding | Status | Where | Regression |
| --- | --- | --- | --- | --- |
| 27 | `EnsureDeletedAsync` on an arbitrary `TEST_DATABASE_URL` | **Fixed** | `tests/.../Infrastructure/PostgresFact.cs` — three independent gates (explicit `SUSUMU_ALLOW_DESTRUCTIVE_TEST_DB=true`, loopback host, deliberately named `susumu_test`/`susumu_ci[_suffix]`), checked by `RequireApprovedTarget()` before any connection is opened. The connection string is never returned in a reason, logged or asserted on. | `TestDatabaseGuardTests` (8 tests, including `susumu_dev` refused and the reason not echoing host/user/password) |

## Backend review bullets

| Finding | Status | Where | Regression |
| --- | --- | --- | --- |
| Remove design-time fallback password/connection | **Fixed** | `SusumuDbContextFactory.cs` throws unless `SUSUMU_DB_CONNECTION` is set; no default connection and no credential in source. The XML doc states plainly that this is a guard rail and cannot prove the target is not production. | `DesignTimeFactoryTests` |
| Durable flush before acknowledging an upload | **Fixed** | `Storage/PhotoStorage.cs` now calls `Flush(flushToDisk: true)` (platform flush-to-disk) before the atomic `File.Move`. `FileMode.CreateNew` on the temp file means a crash leaves a temp file, never a truncated object. | `PhotoTests.Retrying_the_same_upload_succeeds_without_duplicating_anything` |
| Version increments exactly 1; replay never increments | **Already correct**, now pinned | `InspectionSyncService.ApplyDraftChanges` | `SyncReviewRegressionTests.Each_accepted_operation_increments_the_version_by_exactly_one_and_replays_do_not` |
| Company/locations/employees administration | **Owned by the Codex worker**, integrated by me | Worker files untouched. I registered `OrganizationAdministrationService`, mapped `MapOrganizationAdministrationEndpoints()`, and switched `OnModelCreating` to `ApplyConfigurationsFromAssembly` so `EmployeeConfiguration` is picked up without editing shared mapping code. My services now join the worker's `BeginCompanyWriteAsync` serialization. | `OrganizationAdministrationTests` (worker's), plus my `A_concurrent_assignment_cannot_land_in_a_deactivated_location(user/vehicle)` arms now pass |
| `TEST_DATABASE_URL` must actually use PostgreSQL | **Done** | See the header: 0 skipped. | — |

## Numbered findings 1–19

| # | Status | What the code does now | Regression |
| --- | --- | --- | --- |
| 1 | **Fixed** | An unknown inspection with `expectedVersion != 0` is refused with 409 instead of being created as version 1. | `Creating_an_inspection_with_a_non_zero_expected_version_is_refused` |
| 2 | **Fixed** | `Vehicle.CurrentOdometerKm` is an EF concurrency token, so the losing writer of a concurrent finalization cannot commit an older reading. The sync service retries the whole operation up to 3 times on that conflict (nothing was committed, so replay is safe) rather than returning a 409 the device would treat as permanent. Finalization only ever moves the meter forward. | **PostgreSQL:** `Concurrent_finalizations_on_one_vehicle_never_regress_the_odometer` |
| 3 | **Fixed** | Both the `DbUpdateConcurrencyException` and `DbUpdateException` paths now call `TryReplayCommittedReceiptAsync` after rollback, so a concurrent identical retry replays the accepted answer. | **PostgreSQL:** `Concurrent_identical_retries_on_an_existing_draft_all_replay_one_result` |
| 4 | **Fixed** | Precision is validated *before* hashing: more than 4 decimal places, or a magnitude outside the stored range, is a 400. The canonical rounding is therefore a no-op and can no longer merge two different submissions. Template bounds are validated the same way. | `A_measurement_with_more_precision_than_is_stored_is_refused_rather_than_rounded`, `Four_decimal_places_are_accepted_and_stored_exactly` |
| 5 | **Fixed** | `JsonStringEnumConverter(namingPolicy: null, allowIntegerValues: false)` rejects numeric enums; `Enum.IsDefined` is re-checked at the service boundary; a **missing** item status is rejected instead of silently becoming `OK` (`InspectionItemDto.Status` is nullable so absence is detectable). | `A_numeric_or_undefined_enum_value_is_refused`, `An_item_without_a_status_is_refused_instead_of_being_recorded_as_OK` |
| 6 | **Fixed** | Client `startedAt`/`finalizedAt` are stored verbatim; `receivedAt` stays the server time. A missing/default `startedAt` is a 400, as is a timestamp outside 2020-01-01…now+1 day. Drift beyond 5 minutes is accepted and written to the audit log as `inspection.clock.skew`. | `The_client_timestamps_are_kept_verbatim_and_receivedAt_is_the_server_time`, `A_missing_or_default_startedAt_is_refused`, `A_device_clock_far_from_the_server_is_accepted_but_audited` |
| 7 | **Fixed** | A photo id declared on two items is a 400; moving a declared photo to a different item is a 409. The kind of a declared attachment cannot change to or from `Signature`. | `One_photo_declared_on_two_items_is_refused`, `Moving_a_declared_photo_to_another_item_is_refused` |
| 8 | **Fixed** | Bounds before any write: `correctionReason` ≤ 1000, item notes ≤ 2000, inspection notes ≤ 4000, ≤ 2000 items, ≤ 50 photos per item, ≤ 500 declared photos, measurement precision/range as in #4. | `Oversized_free_text_and_photo_counts_are_refused_before_any_write` |
| 9 | **Fixed** | `finalizedAt < startedAt` is a 400. A vehicle with **no** recorded reading accepts a legitimate `0`, which is what a tablet sends for a new vehicle — this removes one of the client review's dead-end triggers. The implausible-jump ceiling is computed in `long`. | `An_inspection_cannot_be_finalized_before_it_was_started`, `A_vehicle_with_no_recorded_reading_accepts_a_legitimate_zero_odometer`, `The_implausible_jump_ceiling_cannot_overflow_near_int_max` |
| 10 | **Already fixed** in the first delivery | `offset`/`limit` with explicit rejection of out-of-bounds values; stable `startedAt DESC, id DESC`. | `PagingTests` (4 tests) |
| 11 | **Already fixed** | Undeclared post-finalization ids are refused for **every** kind including `Signature`. | `A_photo_that_was_not_declared_cannot_be_added_to_a_finalized_inspection`, `A_signature_cannot_be_uploaded_under_an_undeclared_id_after_finalization` |
| 12 | **Fixed** | Upload is author-only. A supervisor corrects through a new inspection and never takes over pending evidence. | `A_reviewer_cannot_upload_into_another_inspectors_inspection` |
| 13 | **Fixed** | `metadata.itemId` must match a recorded item of the inspection; a retry with identical bytes but a changed claimed relationship (kind, itemId, originalPhotoId) is a 409, not a silent success. | `Identical_bytes_with_a_different_claimed_relationship_do_not_pass_as_a_retry` |
| 14 | **Fixed** | The object key is `…/{photoId}.bin`, independent of the content type, so two concurrent uploads cannot write two files for one declared photo. `PhotoRecord.Uploaded` is a concurrency token: the loser re-reads the winner and must agree with it or be refused, and the winning checksum is what stands. | `Uploading_different_bytes_for_a_stored_photo_is_refused`, `The_stored_path_comes_from_identifiers_and_ignores_the_client_filename` |
| 15 | **Fixed** | New `Storage/ImageValidation.cs` walks every PNG chunk header and every JPEG marker segment, requires a terminator, refuses declared lengths that overrun the file, and caps dimensions (20 000/side, 80 MP). It parses headers only and never decodes pixels, so validation is bounded in time and memory — and no third-party imaging licence is introduced. | `A_truncated_image_is_rejected_even_though_its_header_is_valid`, `An_image_declaring_an_unreasonable_canvas_is_rejected`, `Content_that_does_not_match_the_declared_image_type_is_rejected` |
| 16 | **Already fixed** | A non-company-wide reviewer only sees audit rows for inspections in their location, or rows they authored. | `A_supervisor_does_not_see_audit_rows_from_another_location`, `The_audit_of_an_out_of_scope_inspection_is_not_disclosed` |
| 17 | **Fixed** | `pendingPhotos` counts **inspections** with at least one undelivered attachment, matching the web label. | `Dashboard_pending_photos_counts_inspections_not_photo_rows` |
| 18 | **Fixed** | An export above 20 000 inspections is refused with a 400 naming the match count and telling the operator to narrow by `vehicleId`/`state` — it is never silently truncated. Formula neutralisation now looks at the first *significant* character, so `" =cmd"` and `"\t@ref"` are prefixed too. | `An_export_larger_than_the_limit_is_refused_with_a_filter_instruction`, `Formula_markers_behind_leading_whitespace_are_neutralized`, `Csv_cells_are_escaped_and_never_execute_or_break_the_row` |
| 19 | **Fixed (source and instructions only; nothing executed against production)** | `Seed/InitialProvisioning.cs` and `Configuration/ProvisioningCommand.cs`: `dotnet run --project src/Susumu.Api -- provision` applies migrations and creates the first company, location and administrator from operator-supplied environment variables, then exits without starting a listener. It refuses to run when any user already exists, never enables the DEV fixture, and never logs the password. | `ProvisioningTests` (3 tests) |

## Numbered findings 20–28 and the extras

| # | Status | What the code does now | Regression |
| --- | --- | --- | --- |
| 20 | **Fixed** — this is the failure the root PostgreSQL smoke caught | System.Text.Json consults `options.Converters` **before** a `[JsonConverter]` attribute on the type, so the blanket string-enum converter was winning and emitting `Status`/`Measurement`. `SusumuJson.Configure` now registers `ResponseTypeJsonConverter` first and is applied to both the internal serializer and the minimal-API options, so they cannot drift. | `ResponseType_is_serialized_lowercase_on_the_real_http_response` (asserts on the raw HTTP body), `ResponseType_is_accepted_lowercase_on_input` |
| 21 | **Already implemented** | Declared `signaturePhotoId` with a Pending placeholder, finalization on declaration rather than upload, immutable post-finalization upload, retirement/activation that never rewrites a published definition. | `SignatureTests` (7), `TemplateAvailabilityTests` (4) |
| 22 | **Fixed** | Account administration serializes on the company row via the worker's `BeginCompanyWriteAsync` (PostgreSQL `SELECT … FOR UPDATE`), and `Company.AdministrationStamp` is an EF concurrency token bumped by every account change as a second barrier. The preflight count is no longer the only protection. | **PostgreSQL:** `Concurrent_self_demotions_cannot_leave_a_company_without_an_administrator`; single-process: `The_company_administration_stamp_advances_on_every_account_change` |
| 23 | **Fixed** | Login and per-request token validation both require the account **and** its company **and** its location to be active. Location assignment for users and vehicles also requires an active location. | `An_inactive_company_blocks_both_new_logins_and_tokens_already_issued`, `An_inactive_location_blocks_both_new_logins_and_tokens_already_issued` |
| 24 | **Fixed** | `CreateUserRequest.Role` is nullable, so an omitted role is detectable and refused instead of deserializing to `Administrator = 0`. Numeric roles are refused by the converter. The same treatment is applied to `ChecklistItemWriteDto.ResponseType` (an omitted value would have silently made a measurement into a checkbox). | `A_create_user_request_without_a_role_is_refused_instead_of_creating_an_administrator`, `A_numeric_role_is_refused` |
| 25 | **Fixed** | Two independent budgets: 5 failures per **account**, and per **source** 50 raw failures *or* 12 distinct accounts. Behind a shared proxy address one person with a wrong password can no longer lock out the workshop, while spraying is still caught by the distinct-account budget. Forwarded headers are honoured only for proxies explicitly listed in `Network:TrustedProxies`; with none configured an arbitrary `X-Forwarded-For` is ignored. Policy documented in `README.md`. | `One_locked_out_account_does_not_lock_out_the_rest_of_a_shared_proxy_address`, `Spraying_many_accounts_from_one_source_is_still_blocked` |
| 26 | **Fixed** | Username ≤ 120 and password ≤ 256 are checked **before** hashing and before any audit insert, so an oversized input can neither burn PBKDF2 CPU nor overrun `audit.details`. The submitted password is never recorded. | `An_oversized_username_or_password_is_refused_before_hashing_or_auditing` |
| 28 | **Already fixed** | `GET /inspections?supersedesInspectionId=…` with the same scope and paging. | `Corrections_of_one_inspection_can_be_listed_explicitly` |
| extra | **Fixed** | `PUT /vehicles/{id}` refuses a reading lower than the stored one with 409, and runs under the same concurrency boundary as finalization, so a stale web edit cannot put an older meter back. A deliberate meter replacement remains a separate future audited operation. | `An_administrative_edit_cannot_put_back_an_older_odometer_reading` |
| extra | **Fixed** | CI coordination: `Susumu:IgnoreEnvironmentOverrides` makes the process environment inert for a host that has already chosen its database, so a `SUSUMU_DB_CONNECTION` exported for the demo API or for `susumu_ci_tests` cannot redirect a unit-test host. | `A_process_wide_database_connection_cannot_hijack_the_unit_test_host` |

## From the client review

| Item | Status |
| --- | --- |
| HIGH 4 — `offset` ignored by the API | **Already fixed** before the review was written; the ordering tiebreak is `startedAt DESC, id DESC` as the contract requires. `PagingTests`. |
| MEDIUM 5 — superseded banner lost outside the newest 100 | **Fixed on the API side**: `InspectionDto.supersededByInspectionId` is now projected (resolved in one extra query for the returned page), so a report never has to scan a truncated window. `A_superseded_inspection_reports_its_correction_directly`. |
| BLOCKER 1 / HIGH 2 / HIGH 3 / MEDIUM 6 | Mobile-owned; the mobile owner is fixing them. The API side of BLOCKER 1's second trigger is closed here: a legitimate `0` odometer on a vehicle with no recorded reading is now accepted (#9), so that particular payload no longer becomes a permanently rejected operation. |
| "`signaturePhotoId` not present in backend" | Stale observation: it was added before the review was published. `SignatureTests`. |

## Not closed

- **Organization administration is the Codex worker's**, and I did not review its internals. I only
  wired it in and made my own services join its `BeginCompanyWriteAsync` serialization. Its tests
  pass in my runs, but I am not the author and do not vouch for its business rules.
- The login throttle remains **in-process**. Behind more than one API instance each instance
  throttles independently; the account budget still protects a single credential, but a coordinated
  spray across instances gets a larger budget. Moving it to shared state is not done.
- No production deployment, no production provisioning run, and no physical tablet validation. The
  provisioning command is delivered as source plus instructions only.
