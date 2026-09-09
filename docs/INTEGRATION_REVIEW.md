# Integration review ledger

2026-09-09. Open observations for component completion; not final verification.

## Mobile review

- Measurement could be cleared when only notes/status/photo changed due to optional argument null. Reported to mobile worker; regression and explicit-clear semantics requested.
- Snapshot photo attachment inputs before asynchronous lookup to avoid concurrent UI edits mutating in-flight payload.
- Failed SQLite finalization must not leave the on-screen draft irreversibly marked finalized while the persisted draft remains editable.

## Backend review to apply after initial implementation

- Remove design-time fallback password/connection from SusumuDbContextFactory. Require explicit SUSUMU_DB_CONNECTION for operations that can modify schema; no claim a factory can never point to production.
- Flush attachment bytes durably before acknowledging upload; FlushAsync alone is not an fsync guarantee. On-disk object must not be truncated on retry or collide with metadata after a crash.
- Each accepted new sync operation increments version exactly1; replay of stored receipt never increments. Mobile depends on this documented invariant.
- Include company/locations/employees administration endpoints added to IMPLEMENTATION_CONTRACT.md to cover V1 master modules. No global admin or arbitrary cross-company writes.
- Runtime environment names must be reconciled with operations scripts before delivery. TEST_DATABASE_URL integration must actually use PostgreSQL; missing DB is not a successful integration check.

### Concrete findings from initial InspectionSyncService read (before author completion)

1. New inspection path did not require expectedVersion0. Reject any other expectedVersion instead of accepting with version1.
2. Concurrent finalizations of different inspections on one vehicle can race on vehicle odometer and regress it: both read old current value, lower write may commit last. Use appropriate database concurrency/locking and a real PostgreSQL concurrent test; no silent data loss.
3. DbUpdateConcurrencyException branch should attempt same receipt replay after rollback too. Concurrent identical retry on an existing draft must replay accepted operation rather than returning409 that permanently blocks the mobile queue.
4. CanonicalPayload rounds measurement to4 decimals but application accepts finer precision. That can treat different submitted values as identical and silently round persisted data. Validate supported precision/range before hashing or preserve full canonical input; document numeric bounds. Add changed-fifth-decimal test.
5. Enforce defined enum values and disallow numeric enum JSON values. Required responses must not accept undefined enum999. Validate service boundary too.
6. Do not silently replace client's future/default StartedAt/FinalizedAt with server time. Preserve supplied valid client times separately from ReceivedAt; reject missing/default values, flag suspicious clock difference in audit. Client timestamp must remain auditable.
7. Reject one photoId declared on multiple items and rebinding existing photo to another item. Current dictionary assignment overwrites a duplicate association silently.
8. Validate correctionReason length, per-item note length, maximum section/item/photo counts and reasonable measurement precision/range before database writes. Keep request limits and problem responses deliberate.
9. Date ordering: finalization must not precede start. Zero odometer handling must match clients (allow legitimate0, or align explicit domain error); avoid int overflow in current+MaxOdometerJumpKm.
10. Bounded history lists need pagination so historical records remain discoverable. Preserve current array DTO; add optional offset/limit query parameters, stable ordering and documented maximum. Web must label recent windows or paginate, not promise inaccessible complete history.

### Attachment and reporting review

11. PhotoService allowed a new Signature photo after Finalized although finalized attachment set is immutable. Reject all undeclared post-finalization IDs, including Signature.
12. PhotoService accepted reviewer uploads into someone else's pending inspection evidence. Prefer author-only upload for this V1 ownership model; supervisor corrects through new inspection, not by taking over original pending bytes.
13. Validate itemId against pinned template and enforce stable item/kind/originalPhotoId association. Duplicate retry with same bytes but changed metadata must not silently succeed with different claimed relationship.
14. Concurrent uploads to an existing placeholder can write different .jpg/.png files and race metadata updates. Use a stable photo object key independent of extension plus database concurrency/locking; test two concurrent differing payloads and ensure one409 and immutable winning checksum.
15. Verify image structure beyond only3 JPEG or8 PNG bytes; reject truncated payload and dangerous dimensions/decompression size. Use a license-compatible decoder or rigorous bounded validation; do not claim magic bytes alone prove a valid image.
16. ReportingService.AuditAsync without inspectionId filtered only CompanyId. A Supervisor must not read other locations' audit; scope by inspection/location or restrict non-admin audit to visible inspection events. Add cross-location test.
17. Dashboard pendingPhotos currently counts photos while web labels inspections awaiting photos. Choose and document one meaning; preferred contract meaning is number of inspections with pending photos (count inspections.Any(photo not Uploaded)).
18. CSV must not silently truncate at20,000 inspections. Stream or explicitly reject over-limit export with a clear filter instruction. Neutralize leading whitespace/control before formula markers, not only first character, and cover newline/formula payloads.
19. Provide an explicit initial-account provisioning command for an empty production installation with operator-supplied secrets; do not require inserting users directly into production DB or enabling demo fixtures there. Deliver source/instructions only; do not execute in production.

## Operations evidence received

Portable PostgreSQL18.6 integration for backup/restore: separate ops_source_20260909222045 -> ops_restore_20260909222045. Fixture row714 and photo checksum preserved; second restore rejected existing DB. Evidence in ignored .local/ops-validation-20260909222045/validation.json. Compose configuration and Caddy syntax validated without Docker engine; containers not yet executed locally.
20. Verify ResponseType JSON actually emits lowercase status/measurement as contract: global JsonStringEnumConverter precedence can override type attribute converter. Add explicit converter ahead of global converter and serialization/API test if needed.

21. Full V1 signature and template retirement contract now appended to IMPLEMENTATION_CONTRACT.md. Implement signaturePhotoId pending placeholder, required signature declaration rather than preuploaded-only requirement, immutable upload, retirement/activation without rewriting published definition. Mobile/admin workers implement matching UI. Add tests including finalization offline with declared pending signature then upload.

### Independent authentication review (Codex toolchain reviewer, before backend completion)

22. HIGH: UserAdminService count-other-admins followed by separate update permits concurrent self-demotions of the last two admins to leave zero. Lock company row / serialize relevant administration and add real PostgreSQL concurrency regression. Avoid relying on a preflight count alone.
23. HIGH: login and per-request token validation only check user.Active/security stamp, ignoring inactive Company/Location. Validate both associations as active in authentication and user/location assignment. Tests: disable company/location while user active -> both new login and old token rejected.
24. Missing create-user Role can deserialize to Administrator=0; make role explicitly required and defined, reject missing/numeric role input instead of granting admin by default. Endpoint is admin-only but accidental overprivilege remains a defect.
25. Login throttling behind Caddy uses proxy IP with shared low budget (5 failures/15min) and can lock out every workshop user. Introduce safely configured trusted forwarding (never blindly trust arbitrary XFF), or design throttle account+source limits that remain useful without one user exhausting the whole proxy budget; test proxy-shared distinct accounts and brute-force behavior. Document actual policy.

26. Auth input bounds must cover username/password before hashing and failed-login audit insertion. Username max120 matches model; choose password bound compatible with creation/reset and reject oversized inputs with400. Unbounded username can overrun audit.details max2000 and turn invalid credentials into500; do not record submitted passwords.

Independent evidence for item24: isolated executable using current DTO and Web JSON options reproduced omitted role -> Administrator and numeric999 ->999 on2026-09-09. This is confirmed deserialization behavior, not just inference.

27. BLOCKER test safety: PostgresIntegrationTests calls EnsureDeletedAsync on arbitrary TEST_DATABASE_URL. Before any execution, require a loopback host and a deliberately named throwaway database (susumu_test or susumu_ci[_suffix]), reject other hosts/database names, and never log the connection string. Prefer creating an isolated unique test database/schema; require explicit safe test opt-in for destructive resets. CI must set the guarded test connection so PostgreSQL tests really run, separate from susumu_dev. Add guard regression. Root has not executed the current destructive tests.

28. Reports require direct correction relationship query: GET /inspections?supersedesInspectionId={originalId}&offset=&limit= (company/location scope preserved). Filtering newest100 vehicle inspections loses the superseded banner for older history. Implement API filter; admin worker fixes client and regression.

Actual localhost PostgreSQL API integration was executed on2026-09-09: unauthenticated401 and bad password401 passed; bootstrap responseType exact-lowercase assertion failed (Status/Measurement emitted). The root runner stopped nonzero as required. This confirms item20 on the real serialized HTTP response.

Additional odometer finding linked to item2: VehicleService.UpdateAsync currently writes CurrentOdometerKm unconditionally when provided, without comparing the persisted current value or sharing finalization's concurrency control. A stale web edit opened before a finalization can put the older reading back (web includes odometer in its edit payload). Enforce monotonic reading on API administrative update under the same vehicle row lock/concurrency boundary as finalization. A deliberate meter replacement needs a separate future audited operation, not an implicit lower write. Add direct API stale-edit regression, not just UI validation.

CI/test guard coordination: use explicit SUSUMU_ALLOW_DESTRUCTIVE_TEST_DB=true in addition to TEST_DATABASE_URL and verified loopback + safe name. CI backend integration tests target susumu_ci_tests; root Node/API smoke keeps its separate initially empty susumu_ci database so independent seed credentials never collide. Local guarded backend tests may use existing synthetic susumu_test on127.0.0.1:55432; DB password is in .local/postgres/password.txt and must only be read into process environment, never printed. PostgreSQL18.6 is installed/running here now; README's earlier unavailable-server note must be replaced with actual evidence after execution.

### Organization worker integration handoff (2026-09-09 23:02 JST)

New file integration names: services.AddOrganizationAdministration() (Susumu.Infrastructure.Services); api.MapOrganizationAdministrationEndpoints(); db OnModelCreating ApplyConfigurationsFromAssembly(typeof(SusumuDbContext).Assembly) discovers EmployeeConfiguration. DTOs CompanyDto/CompanyWriteRequest, LocationDto/CreateLocationRequest/UpdateLocationRequest, EmployeeDto/EmployeeWriteRequest.

OrganizationAdministrationService.BeginCompanyWriteAsync(db, companyId, ct) starts a transaction and locks the company row on PostgreSQL. Shared user/vehicle administrative writes should use this same lock order before checking target active location/user and retain through SaveChanges+Commit. This prevents location deactivation racing a new active assignment, and serializes last-admin checks. Vehicle finalization/update must additionally share vehicle locking so readings cannot regress. Avoid reverse lock order or nested transactions; inspect the helper and integrate deliberately.

Organization independent reviewer also fixed a queued-authorization race: a request can authenticate as admin, wait for company-row lock, then proceed after that actor was demoted/deactivated by the preceding transaction. New OrganizationAdministrationService re-reads persisted actor Role/Active/company/location AFTER lock acquisition. Apply this same post-lock persisted-actor authorization check in UserAdminService/VehicleService administrative writes; do not rely only on the pre-lock CurrentUser claims snapshot. Add deterministic queued-revocation regression if needed. The org service tests now cover its own case.
