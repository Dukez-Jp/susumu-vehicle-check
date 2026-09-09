# Claude Code targeted client verification, round 2

Date: 2026-09-09. Session: 9cc4c49e-ffb9-4d57-a5a5-e8348a0b712c. Read-only source review; test execution is tracked separately.

## Verification scope

Read-only, targeted at findings 1, 2, 3, 5, 6. I read `mobile/README.md`, `mobile/lib/data/{database,sync,recovery,photos,camera,review_copy,editor,session}.dart`, `mobile/lib/domain.dart`, `mobile/lib/screens/{queue,retained_work,home,inspection}.dart`, `mobile/test/{isolation,camera,review_copy,queue_widget,offline_store}_test.dart`, `admin-web/src/pages/Inspections.tsx`, `admin-web/src/test/corrections.test.tsx`, and `backend/.../InspectionQueryService.cs` only to confirm the server side of finding 5.

**I executed nothing.** No `flutter test`, no `flutter analyze`, no vitest, no build. Test files are cited as *written coverage*, never as passing results.

---

## Finding 1 — permanent rejection killed the whole outbox → **RESOLVED in source**

- `database.dart:194-226` — `claimNext` now walks the queue and takes only each aggregate's head (`if (!seen.add(candidate.inspectionId)) continue;`), skipping blocked/incomplete heads without ever promoting that aggregate's tail. `excluded` seeds the same set from the caller.
- `sync.dart:59,85` — a failed operation defers only its own `inspectionId`; the loop continues to other inspections. 401 still rethrows (`:84`) before deferral, so token loss is not misclassified.
- `sync.dart:89-133` — the early `return` on a non-empty queue is gone; photo upload now always runs.
- Local-first closure of my primary repro: `domain.dart:247-252` rejects a >200 000 km jump at `validationErrors()`, so the odometer typo can no longer be finalized locally into an unfixable payload.
- Escape hatch exists and is explicit: `ReviewCopyService.create` (`review_copy.dart:22-45`) requires a *blocked* operation of the current owner, keeps the sealed original and the frozen attempted payload, and `queue.dart:174-185` exposes it only for blocked rows to an editable session.

Coverage: `isolation_test.dart:17-33` (blocked head + its tail stay frozen while inspection-2 advances, `queue.first.payload == head.payload`), `isolation_test.dart:35-116` (422 on inspection-1, inspection-2 still sent, `calls == ['inspection-1','inspection-2']`), `queue_widget_test.dart:77-126` (blocked sealed inspection → review copy → original queue payload unchanged), `review_copy_test.dart:33-157` (source draft JSON byte-identical after the copy; signature cleared; annotation remapped to the copied original; `historyReviewed` gate). `offline_store_test.dart:168-178` was correctly re-scoped to "blocks *that inspection*".

## Finding 2 — one bad photo stopped all photo uploads → **RESOLVED in source**

`sync.dart:100-133`: the per-photo `catch` records `photoResult(..., error: ...)`, increments `failures`, and continues; only 401 rethrows. `sync.dart:134-136` resets backoff whenever any operation or photo made progress. `sync.dart:141-149` reports blocked operations and failed photos separately instead of a single stall message. `isolation_test.dart:66-109` asserts `uploads == 2` with one uploaded and one errored photo from a first-call 422.

## Finding 3 — camera marker blocked the second user → **PARTIALLY RESOLVED** (one new permanent trap, raised below)

Resolved parts, verified in source:
- One global journal + lock (`photos.dart:18-26` `serializeCamera`, instance-scoped to the single `PhotoStore` created in `main.dart:23` and threaded to both call sites — `inspection.dart:118`, `recovery.dart:46`), matching the accepted design.
- Draining happens under the **journaled** owner (`camera.dart:77-141`, `owner = journal['owner']`), before the new journal is written (`camera.dart:54-62`), and A's drained result is discarded rather than returned to B (`camera.dart:74`). Files land in A's owner-hashed private tree (`photos.dart:67-74`) and are linked later by A's own `recoverFiles`.
- Unsupported format/size is quarantined and the marker cleared (`camera.dart:121-130`, `photos.dart:141-169`), so a HEIC/oversize return no longer traps retake.
- `pick()` throwing (permission denial, cancel) clears the marker (`camera.dart:66-71`); a null pick journals `paths: []` and drains to a clean clear (`camera.dart:72-74,139`).
- Stable IDs across retries (`camera.dart:81,108` UUID v5 from `captureId`) plus `preserve`'s sidecar identity check and `.partial` staging rename (`photos.dart:91-139`) make re-preservation idempotent.

Coverage: `camera_test.dart:51-85` (write failure retains path, later recovery consumes no lost data, stable v5 id), `:87-117` (A's lost capture preserved under A before B captures; B gets only B's artifact; `recoverable('A')` and `recoverable('B')` both correct), `:118-149` (quarantine once, marker cleared, retake works), `:150-171` (shared lock prevents a concurrent drain while a picker is open).

## Finding 5 — correction banner inferred from newest 100 → **RESOLVED in source**

- `Inspections.tsx:221-225` — dedicated paged query `/inspections?supersedesInspectionId=<id>`; no inference from vehicle history.
- `:295-304` — pending state says "Verificando…", and a failed check renders an explicit "Não foi possível verificar correções… a consulta pode estar incompleta" warning (not wrapped in `no-print`, so it appears on the printed report).
- `:256-263` — print is disabled while the corrections check is pending/fetching.
- `:319-329` — `hasNextPage` is surfaced in-banner and via `LoadMore`, so a truncated page is never presented as "all revisions".
- Server side is present: `InspectionQueryService.cs:16,35-40` (filter), `:21,48-49` (`Paging.Validate` + `Skip/Take`), `:46-47` (`StartedAt DESC, Id DESC` — the stable tiebreak I asked for), plus a `supersededByInspectionId` projection at `:71-95`.

Coverage: `corrections.test.tsx:148-171` reproduces exactly my scenario — correction absent from the newest-100 vehicle window, banner still shown, and asserts no `vehicleId=` call was made; `:172-179` asserts the 403 path renders the incomplete-verification warning.

## Finding 6 — server-origin owner key silently orphaned work → **RESOLVED as designed**

`database.dart:170-180` `hasOtherSessionWork` returns a bare boolean (comment explicitly states no identities), covering both foreign-owner drafts and a foreign-owner camera journal. Rendered generically by `retained_work.dart:12-19` on Home (`home.dart:284`) and Queue (`queue.dart:129`). `queue_widget_test.dart:17-75` asserts the notice appears while `secret-other` never renders, and that the foreign draft still exists afterwards. Owner partitioning itself is unchanged and intentional; the invisibility, which was my actual complaint, is gone.

---

## Residual HIGH introduced by the finding-3 fix — a journaled path whose file is gone traps the camera globally and permanently

**Evidence** — `camera.dart:107-137`. Every path in `journal['paths']` is read with `XFile(paths[index]).readAsBytes()` at `:110` with no existence check. The outer `catch (_)` at `:131` maps *any* failure to `StateError('Captura anterior aguarda preservação…')` and leaves the journal intact. The journal is only cleared on success (`:139`), on a `retrieveLost()` exception (`:94-101`), or when `pick()` throws (`:69`). There is no attempt counter and no missing-source branch.

**Repro**
1. A taps the camera; `pick()` returns a temp path under the app **cache**; `capture` journals `paths` (`camera.dart:72-73`).
2. Storage is full, so `preserve` fails; `_drain` throws and the journal is deliberately retained — the behaviour `camera_test.dart:51-85` locks in as correct.
3. The operator frees space by clearing the app **cache**, or Android evicts the cache dir under the same storage pressure. The private photo tree (app *files*) survives; the picker temp file does not.
4. Every subsequent `_drain` now throws `PathNotFoundException` → `StateError`. `CameraService.capture` drains first (`camera.dart:54`), so **no user** — A, B, or anyone after — can open the camera again, and `HomeScreen.recover()` surfaces the error banner on every launch. Nothing in the app can clear this; only reinstalling, which destroys pending work.

This is narrower than the original finding 3 but the same terminal symptom: evidence capture permanently unavailable on a shared single-tablet workshop, reachable through the low-storage path the feature exists to handle.

**Smallest correction** — In the `_drain` loop, distinguish an unrecoverable source from a failed write. If the journaled path no longer exists (or the read throws `PathNotFoundException`/`FileSystemException` on the *source*), drop that entry from `journal['paths']`, set the existing explicit `warning` ("A câmera não retornou um arquivo recuperável. Tente fotografar novamente."), and let the loop finish so `:139` clears the journal. Keep the current retain-the-journal behaviour only when `photos.preserve`/`quarantine` fails to write the *target*, which is what preserves the space-exhaustion guarantee and keeps `camera_test.dart:51-85` green.

**Regression test** — Seed `db.cache('camera', {owner:'A', inspectionId, itemId, paths:['<deleted path>']})`; assert `service.recover()` returns empty artifacts with a warning and clears the journal; then assert `capture(owner:'B', …)` succeeds, preserves only under B, and leaves `recoverable('A')` empty. Pair it with a negative case asserting a failed *target* write still retains the journal, so the two paths cannot be conflated later.

---

## Lower-severity residuals (not blocking; stated for the record, none newly introduced except where noted)

- **`recoverFiles` still aborts on the first orphan artifact** — `recovery.dart:29-33` throws when a recoverable photo's draft is missing or finalized, so later recoverable photos in the same pass are not linked. Pre-existing, mentioned only in passing in round 1; same head-of-line shape as finding 2. Smallest fix: accumulate the per-artifact error and continue, reporting a count.
- **Full-outage cost of per-inspection deferral** — `sync.dart:59,85`: with N drafts and no network, each cycle now attempts one operation per inspection (N × request timeout) instead of one. No data risk; it does raise `attempts` on N aggregate heads, which disables coalescing for each — consistent with the documented "after the first attempt, ID and bytes are immutable" rule, so I flag it only as a battery/time observation.
- **Odometer `0` local/server mismatch persists** — `domain.dart:240-246` accepts `0` when the vehicle has no recorded reading; `InspectionSyncService.cs:533` rejects `<= 0`. Now *contained* (blocks only that inspection, and the review copy is editable so the operator can fix the value), but it still produces an avoidable rejection. This is the backend author's ledger #9 item, not a mobile defect.
- **Review-copy notes overflow is a deliberate local hold** — `domain.dart:33` counts `notesForServer` (source notes + provenance trace) against the 4000 limit, so a copy of a near-limit inspection stays unsent with an explicit reason until the operator edits it. Matches `README.md:32` ("sem truncamento") and `review_copy_test.dart:14-32`. Intentional, not a defect.

## Consensus position

Findings 1, 2, 5 and 6 are resolved in source with directly matching written tests; finding 3 is resolved for cross-owner misattribution and for both original traps, with one residual HIGH above that I would want closed before integration sign-off. Nothing here is final until CI actually builds and runs all three components — I have not seen a green run and am not asserting one.