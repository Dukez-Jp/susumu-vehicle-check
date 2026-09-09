# Backend notes on the shared contract

Reference: `docs/IMPLEMENTATION_CONTRACT.md`. Every endpoint path, DTO member and enum value in that
document is implemented with the documented name and wire value. Nothing was renamed or removed.

This file records the **additions** and the **behaviour the contract left open**, so the mobile and
web workers can rely on them and the root coordinator can challenge any of them.

## Additions (backwards compatible: existing clients keep working)

| Addition | Where | Why |
| --- | --- | --- |
| `GET /templates/{id}` | new route | The editor needs a single version; list-only forced clients to download every version. |
| `X-Susumu-Idempotent-Replay: true\|false` response header | `POST /sync/inspections` | Lets the tablet distinguish "accepted now" from "already accepted", without changing the body. |
| `GET /health/live` and `/health/ready` also at the root, next to `/api/v1/health/*` | health | Container and reverse-proxy probes usually cannot carry the API prefix. |
| `vehicleId` and `state` query parameters | `GET /exports/inspections.csv` | Same filters the inspection list already accepts. |

`requiresSignature`, `active`, `signaturePhotoId`, `offset`/`limit` paging, the stable orders and
`supersedesInspectionId` come from the contract's "Completion clarifications" section and are
implemented as written there.

## Behaviour chosen where the contract was open

Each choice is the conservative one: it refuses ambiguous work instead of guessing.

1. **Scope.** `Administrator` sees and manages the whole company. `Supervisor`, `Inspector` and
   `Office` are limited to their own location. Every resource query starts from that filter.
2. **Username uniqueness is global**, not per company, so `POST /auth/login` never has to guess which
   company a username belongs to.
3. **Token lifetimes.** Access token 12 h (`Jwt:AccessTokenLifetime`), `offlineUntil` 72 h
   (`Jwt:OfflineWindow`) as the contract requires. Drafts are never discarded when the window lapses;
   syncing simply requires a new login.
4. **Device binding.** `inspection.deviceId` must equal the `device_id` claim of the token used
   (`400` otherwise), and a draft can only be continued from the device that created it (`409`).
   The device id is an ownership/audit attribute, never an authentication factor.
5. **Template pinning.** `templateVersion` must match the referenced version row, the version must be
   published, and its `vehicleType` must equal the vehicle's `type`; otherwise `400`.
6. **Measurement values** are only accepted on `measurement` items (`400` on a `status` item).
   Bounds are enforced at finalization, so an in-progress draft can still be synced.
7. **Odometer.** Finalizing requires a reading greater than zero, not below the vehicle's last
   recorded reading, and at most 200 000 km above it. The vehicle reading is updated on finalization.
8. **Corrections.** `supersedesInspectionId` requires a `correctionReason` of at least 5 characters,
   a finalized original for the same vehicle, and no other finalized correction of that original.
9. **Photo declaration.** Uploading a photo id that was never declared is accepted while the
   inspection is a `Draft` (the row is created) and refused with `409` once it is `Finalized` — for
   signatures too. A photo id already attached to another inspection is refused with `409`, which is
   also what stops a correction from reusing the signature of the inspection it corrects.
9b. **Item set replacement.** Each sync operation carries the full item set of the inspection. Items
   absent from the payload are removed from the draft, so the mobile client must always send the
   complete set rather than a delta.
9c. **Signature binding.** `kind: Signature` is only accepted under the id declared in
   `inspection.signaturePhotoId`, and that id refuses any other kind (`409` both ways). Declaring the
   id is what allows offline finalization; the bytes are chased afterwards through
   `photoUploadState`. After finalization the declared kind can no longer change.
10. **Photo immutability.** Re-uploading identical bytes returns `200` with the stored metadata;
    different bytes for the same id return `409`. Stored bytes are never overwritten or deleted, and
    a declaration that disappears from a later sync is only dropped while it has no bytes.
11. **Upload rejections.** `415` for a content type other than `image/jpeg`/`image/png`, `413` above
    15 MiB, `400` when the bytes do not match `metadata.sha256` or the declared image type's magic
    bytes. Storage paths are built only from ids; the client filename is discarded.
12. **Login throttling** is per username and per caller address, 5 failures in a 15 minute window,
    answered with `429` and `Retry-After`. It is in-process: with more than one API instance each
    instance throttles on its own.
13. **`receivedAt`** is the server time of the most recent accepted write for that inspection.
14. **CSV** is item-level (one row per inspection item, inspection columns repeated), UTF-8 with a
    BOM, every cell quoted, and any cell starting with `= + - @ TAB CR` prefixed with `'`.
15. **`POST /templates/{id}/publish`, `/retire` and `/activate`** take an empty JSON body (`{}`).
16. **Retired versions still sync.** `POST /sync/inspections` accepts any *published* version,
    retired or not, so work pinned to a retired version keeps syncing and finalizing. Only
    `GET /bootstrap` filters by `active`.
17. **Paging is validated, not clamped.** `offset < 0`, `limit < 1` or `limit` above the endpoint
    maximum (500 for inspections, 200 for audit) return `400` with an `errors` entry.

## Changes from the integration review that clients must know about

These came out of `docs/INTEGRATION_REVIEW.md`; the full adjudication is in `REVIEW_RESOLUTION.md`.

1. **`responseType` really is lowercase now.** The blanket string-enum converter used to win over the
   type's own converter and emit `Status`/`Measurement`. Both directions are covered by tests
   asserting on the raw HTTP body.
2. **Enums are strict.** Numeric enum values (`"role": 0`, `"status": 999`) are rejected, and so are
   undefined names. An **omitted** `status` on an item, `role` on a new user, or `responseType` on a
   template item is a 400 instead of silently becoming `OK` / `Administrator` / `status`. The
   corresponding DTO members are nullable so absence is detectable; responses always carry a value.
3. **Timestamps are the client's.** `startedAt` is required and stored verbatim, as is `finalizedAt`;
   the server no longer substitutes its own clock. `finalizedAt` is required when `state` is
   `Finalized` and must not precede `startedAt`. Anything outside 2020-01-01…now+1 day is a 400;
   drift beyond 5 minutes is accepted and audited as `inspection.clock.skew`.
4. **Measurements are limited to 4 decimal places** and to the stored numeric range. A finer value is
   a 400 rather than being silently rounded — which also keeps the idempotency hash honest.
5. **`expectedVersion` must be 0 for an inspection the server has never seen** (409 otherwise).
6. **A legitimate `0` odometer is accepted** when the vehicle has no recorded reading yet.
7. **Photo upload is author-only** (403 for anyone else, including supervisors). A reviewer corrects
   through a new inspection.
8. **Attachments are validated structurally**, not just by magic bytes: truncated files and
   implausible dimensions are rejected with 400.
9. **A retry with identical bytes but a changed claimed relationship** (kind, `itemId`,
   `originalPhotoId`) is a 409, not a silent success. A declared item photo may still resolve from
   `Original` to `Annotation` at upload time, because `items[].photoIds` cannot express that; nothing
   can move to or from `Signature`, and nothing changes once bytes exist.
10. **`PUT /vehicles/{id}` refuses a lower `currentOdometerKm`** with 409.
11. **`GET /exports/inspections.csv` refuses an over-limit export** with 400 and a filter instruction
    instead of silently truncating at 20 000 inspections.
12. **`dashboard.pendingPhotos` counts inspections** with at least one undelivered attachment, not
    photo rows.
13. **Login requires the account, its company and its location to all be active**, for new logins and
    for tokens already issued.
14. **New additive field `InspectionDto.supersededByInspectionId`** — the finalized correction of this
    inspection, so a report shows the superseded banner without scanning a truncated history window.
15. **New endpoint verb `provision`** (a CLI mode of the API, not an HTTP endpoint) for the first
    account of an empty installation.

## Storage and provider notes

- Attachment bytes live on the filesystem under `PhotoStorage:RootPath`, never in PostgreSQL.
  Layout: `<companyId:N>/<inspectionId:N>/<photoId:N>.bin` — one key per photo id, deliberately
  independent of the content type so two concurrent uploads cannot write two files for one declared
  photo. The content type is metadata, and `storagePath` is not part of any DTO.
- Bytes are written before the metadata row is committed. A failure between the two leaves an
  orphaned file, never an inspection that claims to have a photo it cannot serve; the retry with the
  same checksum then succeeds.
- Timestamps are persisted as UTC instants. SQLite cannot `ORDER BY` a `DateTimeOffset`, which would
  have made the fast test provider diverge from PostgreSQL exactly on the ordered history and audit
  queries. See `Persistence/UtcDateTimeOffsetConverter.cs`.
- **PostgreSQL is the only supported production provider.** `Database:Provider=sqlite` exists for
  Development and tests, is refused outside those environments, and uses `EnsureCreated` instead of
  migrations.
