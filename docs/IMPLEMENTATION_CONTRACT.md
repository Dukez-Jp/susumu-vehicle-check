# V1 implementation contract

**Current phase, 2026-09-10:** Wagner now requests documentation-only sketch and test/subtest planning, with no new programming. The implementation authority in the historical baseline below is superseded for this phase. Preserve the V1; follow the current instruction in `AGENTS.md` and `docs/esboco/2026-09-10/`. Proposed business choices require confirmation and are not new implementation requirements yet.

Status: implementation baseline, 2026-09-09. User authorizes autonomous delivery of the complete project and private GitHub commit/push. No production deployment. The purchased tablet is pending delivery. This contract narrows unspecified business choices without substituting production readiness for test evidence.

## Architecture and ownership

One monorepo: `mobile/` Flutter/Dart/Drift; `backend/` .NET 10 EF Core PostgreSQL18; `admin-web/` React/TypeScript; `infrastructure/` Docker Compose; `docs/`, `decisions/`, `tests/`, `scripts/`. API prefix `/api/v1`. JSON camelCase; UUID strings; ISO8601 UTC timestamps. Errors use ProblemDetails with `title`, `detail`, HTTP status, optional field errors. Standard status codes 400/401/403/404/409/413/415/429.

Claude owns `backend/` (including its tests/migrations/API documentation). Mobile worker owns `mobile/`; web worker owns `admin-web/`; root owns shared contract, infrastructure, docs and integration. Workers do not commit or change branches. Separate ownership in a fresh isolated project avoids file conflicts; integration branch is `feature/v1-implementation`.

## Access and data policy

Roles (wire values): `Administrator`, `Supervisor`, `Inspector`, `Office`. All resource endpoints authenticated and scoped to the user's company and location. Administrator may manage users/vehicles/templates in own company; Supervisor finalizes/reviews and manages templates; Inspector creates own inspections; Office reads reports. Account/role changes invalidate access via server-side user checks. Never trust actor/company fields sent by clients. Offline session permits drafts for 72 hours after online authentication, tied to one user/device; new login required to sync after token expiry. No plaintext password storage on client. Tokens in OS-backed secure storage on Android; web token in memory only. Logout must preserve pending local work and prevent another user reading/sending it.

No collaborative editing of the same inspection across devices in V1: each inspection has its own UUID, owner user and device. Independent inspections on one vehicle are permitted and visible; server warns on suspicious duplicates but never merges silently. Finalized records are immutable; corrections create a new inspection with `supersedesInspectionId` and reason, leaving original intact. Report pending versus complete photo uploads accurately.

## Shared DTOs

`User`: `{id, name, username, role, companyId, locationId, active}`.
`Vehicle`: `{id, internalNumber, plate, type, companyId, locationId, currentOdometerKm, active}`. Vehicle 714 is synthetic DEV fixture only.
`ChecklistTemplate`: `{id, name, vehicleType, version, published, sections:[{id,title,items:[{id,label,responseType,required,unit,minValue,maxValue}]}]}`. `responseType`: `status` or `measurement`; status still recorded on every item. Published versions immutable; publish by creating new version. Template version exact ID pinned in every inspection.
`InspectionItem`: `{itemId,status,value,notes,photoIds}`; status in `OK,Attention,Repair,Critical,NotApplicable`; value nullable number; notes string; photoIds list UUID.
`Inspection`: `{id,vehicleId,templateId,templateVersion,deviceId,odometerKm,state,startedAt,finalizedAt,items,notes,supersedesInspectionId,correctionReason,version}`. State `Draft` or `Finalized`; server projections also include `createdBy`, `createdByName`, `receivedAt`, `photoUploadState` (`Pending` or `Complete`). Initial client version0; server version increments on accepted draft change; expectedVersion for conflict detection. Finalizing requires all required responses, valid values, known template, valid odometer and optional signature if required by template policy. Initial templates do not require signature; optional signature stored as separate photo kind.
`Photo`: `{id,inspectionId,itemId,kind,originalPhotoId,contentType,sha256,sizeBytes,createdAt,uploaded}`; kind `Original`, `Annotation`, or `Signature`. Annotation requires existing original reference. Allowed JPEG/PNG only, max15MiB; verify signature/content and checksum, scope, and ownership. Paths generated from IDs, never user filenames. Bytes separate from PostgreSQL. Immutable attachment objects; retry same checksum succeeds, conflicting bytes409. Inspection finalization includes declared photo IDs; server exposes Pending until all bytes verified; no falsely complete inspection.

## API endpoints

- `POST /auth/login` body `{username,password,deviceId}` -> `{accessToken,expiresAt,offlineUntil,user}`. Throttle failures; token signing key from env with minimum32 bytes; no default production credentials.
- `GET /auth/me` -> User.
- `GET /bootstrap` -> `{user,vehicles,templates,serverTime}` (published template versions for user's scope).
- `GET /vehicles?search=` -> Vehicle[]. `GET /vehicles/{id}` -> Vehicle. Admin `POST /vehicles`, `PUT /vehicles/{id}` accept editable Vehicle fields; IDs generated server for creation.
- `GET /templates` -> ChecklistTemplate[]. `POST /templates` creates a new version from `{name,vehicleType,sections}`. `POST /templates/{id}/publish` publishes an unpublished version; published cannot mutate. IDs generated server if absent.
- `GET /inspections?vehicleId=&state=` -> Inspection[] (bounded result, newest first). `GET /inspections/{id}` -> Inspection including scoped photo metadata.
- `POST /sync/inspections` body `{operationId,expectedVersion,inspection}` -> `{inspectionId,version,state,receivedAt,photoUploadState}`. Idempotency operationId bound to actor+device+canonical payload hash. Repeat exact operation returns same response; different payload409. Write inspection, receipt and audit atomically. Validate ownership and optimistic version; finalized records never updated. Audit both finalization and correction links.
- `POST /inspections/{id}/photos/{photoId}` multipart `file`, `metadata` JSON Photo -> Photo. Allow uploading previously declared photos after finalization; never modifying finalized list. `GET /inspections/{id}/photos/{photoId}` authenticated bytes; metadata through inspection response `photos`.
- `GET /dashboard` -> `{vehicles,inspections,drafts,finalized,criticalItems,pendingPhotos,recentInspections}` with counts scoped; recentInspections Inspection[].
- `GET /users` -> User[]; `POST /users` body `{name,username,password,role,locationId}`; `PUT /users/{id}` editable name/role/active (password optional explicit reset). Admin only; prevent deactivating/demoting last admin; location scope enforced.
- `GET /audit?inspectionId=` -> audit rows (Supervisor/Administrator), bounded; fields `{id,actorId,action,entityId,at,details}`.
- `GET /exports/inspections.csv` -> CSV escaped against spreadsheet formula execution. Web report offers print/PDF export with inspection, author, version, item results and photo state.
- `GET /health/live`, `GET /health/ready` unauthenticated liveness/readiness with no secrets, 503 if DB unavailable.

### Organization and employee administration (V1 coverage)

These complete the Companies/Locations/Employees modules explicitly listed in the master. Administrator only, always own company. No global cross-company administrator is introduced.

- `GET /company` -> `{id,name,active}` for current company; `PUT /company` body `{name}` updates its display name with audit.
- `GET /locations` -> `{id,companyId,name,active}[]`; `POST /locations` body `{name}`; `PUT /locations/{id}` body `{name,active}`. Own company only. Reject deactivation of the last active location or a location with active users/vehicles assigned, so operational scope is not silently lost.
- `GET /employees` -> `{id,userId,employeeNumber,name,locationId,active}[]`; `POST /employees` and `PUT /employees/{id}` accept `{userId,employeeNumber,name,locationId,active}`. userId nullable; linked user and location must belong to same company. employeeNumber unique per company. Deactivation preserves inspection history and does not implicitly disable a separate login.

Employee is an administrative record, while User is the authentication identity. An account can be linked to at most one employee in the same company. All new IDs generated server-side. Validation and audit required; no hard deletes.

## Client behavior

Mobile: first-run server HTTPS URL config (http only explicit DEV build), login, bootstrap cache, search/QR by internalNumber/plate/UUID, start inspection, status/measurement/notes/photos, S Pen annotation on copy, autosave persisted before Saved feedback, resume draft, validate/finalize, outbox retries and visible pending/error/conflict state, history. SQLite transaction covers aggregate+outbox. Freeze each operation payload; coalesce only unsent draft writes safely with expectedVersion chaining; one serial sync queue. Do not clear data or delete original photos on logout, failed upload, failed sync or restart. Pending ownership isolation mandatory. Capacity errors explicit. Use camera/image_picker and mobile_scanner; annotation editor supports stylus/touch with separate output. Single-device test data model still stable for future devices.

Web: polished responsive Portuguese dashboard (labels localized through dictionary ready for Japanese), login, vehicles, template editor/publish, inspection detail/history/photos, printable report/PDF, CSV export, users and audit by role. No mock data in production UI; distinguish loading/empty/error/offline. Default dev API via Vite proxy; same-origin API behind Caddy in deployment. Do not hide unavailable functionality with fake success.

## Required evidence

API: database integration tests against PostgreSQL when available, auth/role/scope rejection, idempotency changed-payload conflict, optimistic conflict, immutable finalization, required items, measurement bounds, photo validation/immutable original, template snapshot, audit, migration creation. Mobile: persistence/reopen, transactional outbox, retry payload stability, wrong-owner isolation, finalization validation, widgets. Web: API errors/auth state, template validation, report states, production build and lint. Integration: login->vehicle714->published template->draft->finalized->retry->history, backup/restore isolated database. CI builds all three components; no false green jobs skipping checks.

## Completion clarifications: signature and template availability

`ChecklistTemplate` also includes `requiresSignature:boolean` (defaultfalse) and `active:boolean` (defaulttrue). `TemplateWriteRequest` accepts requiresSignature; active is controlled separately. `POST /templates/{id}/retire` and `POST /templates/{id}/activate` (Administrator/Supervisor in company scope) toggle availability with audit, never changing published sections/items/version. GET /templates retains all historical definitions; bootstrap includes active published versions only. A preexisting offline inspection pinned to a retired published version remains valid; retirement stops offering that version for new online selection and does not invalidate saved work.

`Inspection` includes `signaturePhotoId:UUID|null`. This declares a separate signature attachment with `kind:Signature`, `itemId:null`, `originalPhotoId:null`. Sync atomically creates a Pending signature placeholder just as it creates item photo placeholders. Finalization with a signature-required template requires a declared signature ID, without waiting for connectivity/upload; photoUploadState remains Pending until all declared bytes are verified. Upload after finalization is allowed only for that declared immutable signature ID. Signature IDs cannot be shared with item photos. No undeclared post-finalization signatures, metadata rebinding, signature edits or removals after finalization. Corrections start a new inspection and require a fresh signature. The mobile pad persists a separate PNG and manifest before the aggregate/outbox transaction; required signature validation is enforced both locally and by server.

Inspection list/history: optional offset default0 and limit default100/max500, stable order startedAt DESC then id DESC. Return array for compatibility; clients use Load more until a short page. Audit similarly supports offset/limit and stable order at DESC then id DESC. Reject invalid negative/out-of-bounds query values explicitly.

Correction history: GET /inspections also accepts optional supersedesInspectionId to retrieve directly all visible corrections for one original, with the same offset/limit behavior. Reports use this explicit relationship filter, never infer absence of a correction from a recent vehicle-history window.

Offline review clarification: operations remain ordered within each inspection, but a permanently rejected inspection must not prevent unrelated inspections or already-declared photos from syncing. Preserve every rejected attempted payload and make its cause/review action visible. One failed photo does not prevent other eligible photos from uploading. Changes of server/account never auto-transfer pending work; provide a generic notice that other-session pending data is preserved without exposing another user's details.

## Master scope completion: vehicle type catalog and answer options

The master's V1 explicitly lists vehicle types and configurable answer options. These additions complete those modules without changing existing persisted identifiers or inspection history.

`VehicleType`: `{id,code,name,active}`. Own-company authenticated `GET /vehicle-types` (so Supervisors can choose types for templates); Administrator-only `POST /vehicle-types` body `{code,name}`, `PUT /vehicle-types/{id}` body `{name,active}`. Code is immutable, trimmed, 1–80 characters without control characters, unique within company case-insensitively; name 1–120. Deactivation blocks new vehicle assignments and new checklist templates of that type but never alters existing vehicle/template/history references. No hard deletes. Vehicle `type` and template `vehicleType` remain the stable code strings for offline/backward compatibility. A migration backfills all existing distinct vehicle/template type codes into the catalog, including DEV `Truck`; seed provisions its type before vehicles/templates. New or changed assignments require an active catalog code in the same company, using the existing company write serialization. An unchanged existing code remains readable/editable even after retirement. Admin vehicle/template forms choose active catalog entries and retain an existing retired value when editing. Catalog changes audited.

`ChecklistItem`/`ChecklistItemWriteDto` gains optional `allowedStatuses: ItemStatus[] | null`. Omitted/null means all five standard statuses, preserving old templates and cached clients. An explicit list must contain at least one distinct defined wire value from `OK,Attention,Repair,Critical,NotApplicable`; duplicate/unknown values are rejected. This is a configurable subset of the standard safety classification, not arbitrary labels that lose reporting semantics. A required item must allow at least one status other than NotApplicable. Options apply to both status and measurement response types; measurements still carry a status. Published options are immutable with the exact template version. Admin provides labelled option checkboxes; mobile renders only allowed choices and validates a selected value against the pinned options before finalization. An unfinished draft may retain its initial NotApplicable placeholder even if that choice is not allowed; finalization must reject a disallowed value. Explicit options and validation survive offline caching and template versioning. Server rejects disallowed choices on Finalized payloads, preserving draft autosave and rejected-operation bytes. No silent remapping or rounding.

Required means an explicit answer is present. An explicitly selected NotApplicable remains a valid response, including for a required item, when the pinned allowedStatuses permits it; this preserves existing API semantics and legitimate non-applicable workshop checks. Missing/unselected status is distinct from an explicit NotApplicable and cannot finalize a required item. A non-applicable measurement does not need a numeric value. This does not permit a template whose required item's only available choice is NotApplicable.
