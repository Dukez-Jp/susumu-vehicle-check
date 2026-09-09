# Claude Code independent adversarial review

Date: 2026-09-09. Session: 9cc4c49e-ffb9-4d57-a5a5-e8348a0b712c. Actual Claude Code CLI, read-only. Findings describe the reviewed intermediate state; resolution is tracked separately in DELIVERY_REVIEW.md.

## Review boundaries

Read-only session. I read `AGENTS.md`, `docs/IMPLEMENTATION_CONTRACT.md`, `docs/OFFLINE_SYNC.md`, `docs/INTEGRATION_REVIEW.md`, all of `mobile/lib/data/*`, `mobile/lib/domain.dart`, `mobile/lib/app.dart`, `main.dart`, `screens/{home,login,queue,inspection}.dart`, `admin-web/src/{api.ts,auth.tsx,App.tsx,domain.ts,pagination.tsx,pages/Inspections.tsx}`, and the backend pieces needed to judge the client failure paths (`InspectionSyncService`, `InspectionQueryService`, `Mapping`, `InspectionEndpoints`, `Dtos`, `SusumuJson`).

**I executed nothing** — no build, no `flutter test`, no `dotnet test`, no lint. Every claim below is code reading only; no test result is asserted as passing or failing. I excluded unfinished signature/correction UI and org/template-availability UI from findings.

---

## BLOCKER 1 — One permanently-rejected operation kills the whole device outbox forever, and the rejected inspection is locally immutable

**Evidence**
- `mobile/lib/data/sync.dart:69-79` — any `400/403/404/409/413/415/422` (or any `StateError`) sets `blocked = true`.
- `mobile/lib/data/database.dart:167-176` — `claimNext` inspects **only `rows.first`**; a blocked head returns `null` forever, for every aggregate.
- `mobile/lib/data/sync.dart:82-92` — with a non-empty queue, `run()` returns before the photo loop, so evidence for *already accepted* inspections also stops.
- `mobile/lib/data/database.dart:78-81` — the locally finalized draft is immutable, so the user cannot fix the value the server rejected.
- `mobile/lib/screens/queue.dart:50-68` — the blocked row is displayed with no action. There is no unblock/discard/edit path anywhere (`delete(pendingOperations)` exists only in `saveDraft` coalescing and `acknowledge`).

`docs/OFFLINE_SYNC.md:11` requires "usuário recebe ação clara". Today the user receives a label and a dead device.

**Repro (no client/server contract dispute needed)**
1. Vehicle with `currentOdometerKm = 120000`.
2. Inspector types `9120000` (one-digit typo). `home.dart:209-213` accepts it (integer, not decreasing); `domain.dart:183-189` accepts it at finalize (only checks "not lower").
3. Finalize → local state `Finalized`, op queued.
4. Sync → `InspectionSyncService.cs:543-546` returns 400 (`> current + 200000`).
5. `blocked = true`. From now on: no operation for **any** inspection is ever sent, no photo for **any** inspection is ever uploaded, and the offending inspection cannot be edited. Only reinstalling exits — which destroys the preserved data.

Second trigger, same dead end: a vehicle created with `currentOdometerKm = null` prefills `0` (`home.dart:150`), local validation passes (`domain.dart:187`), server rejects at `InspectionSyncService.cs:533`. (The 0-km mismatch is ledger #9; the *unrecoverable global stall* it produces is not.) Third trigger: admin deactivates a vehicle before an offline draft syncs → `InspectionSyncService.cs:294-297` 400. Fourth: `acknowledge`'s strict `version != expected + 1` (`database.dart:212-216`) raises `StateError`, which `sync.dart:70` also classifies as permanent.

**Smallest correction**
1. `claimNext`: select the first operation whose `inspectionId` has no blocked/earlier-pending operation, instead of `rows.first` only. Version chaining is per aggregate (`OFFLINE_SYNC.md:15`), so serial-per-inspection is sufficient and preserves the invariant.
2. `sync.dart:82-92`: do not `return`; report the stall and continue to the photo loop (photos are already gated by the `declared|…` cache, so they cannot outrun their placeholder).
3. Give the blocked operation an action: allow re-opening a locally-finalized inspection that the server has **never** accepted (`serverVersion == 0` for that id) so the value can be corrected, or an explicit, audited discard. Never silent.

**Regression test** (`mobile/test/sync_test.dart`): queue op A (stub returns 400), op B for a different inspection (stub returns 200), and a pending declared photo on already-acknowledged inspection C. Assert: B is sent and acknowledged, C's photo uploads, A stays `blocked` with its payload intact, and the surfaced message names A. Extend `offline_store_test.dart:172-176` — it currently asserts the global stall as intended behaviour, so it must be re-scoped to "blocked A does not block B".

---

## HIGH 2 — A single failing photo stops every remaining photo upload indefinitely

**Evidence** — `mobile/lib/data/sync.dart:94-125`. The `catch` records the per-photo failure and then `rethrow`s, exiting the loop. `db.photos(owner)` (`database.dart:255-263`) has no `orderBy`, so the row order is stable and the same photo is hit first on every cycle. `_failures` never resets (`sync.dart:126`), so backoff grows to ~960 s while the tail never gets a turn.

**Repro** — Inspection with photos P1…P6. Remove P1's file (Android storage cleanup, or restore onto a device without the media directory). Next sync: `sync.dart:105-107` throws `StateError('Arquivo de foto não encontrado')` → loop aborts. P2…P6, and every photo of every other inspection, are never uploaded. The server keeps those inspections `Pending` forever. Same outcome for a 409 conflicting-bytes response or a checksum divergence (`sync.dart:108-113`).

**Smallest correction** — Record the per-photo failure and `continue` to the next photo; aggregate failures into the status message and only escalate backoff if *no* photo succeeded in the pass. Rotate/deprioritise repeatedly-failing photos so one bad row cannot own the head slot.

**Regression test** — Two declared photos where the first stub upload always throws; assert the second uploads, both errors/states are recorded, and the message reports "1 foto exige revisão".

---

## HIGH 3 — Global `camera` recovery marker breaks the second user's camera on a shared tablet, and is left behind on failure

**Evidence**
- `mobile/lib/screens/inspection.dart:118-128` — the marker is written to the **owner-independent** cache key `'camera'` before launching the picker, and `capture` refuses to run while *any* marker exists.
- `mobile/lib/data/recovery.dart:47-50` — `recoverCamera` returns early when `pending['owner'] != sessions.current?.owner`, so it never clears another user's marker.
- `mobile/lib/screens/inspection.dart:137-144` — `removeCache('camera')` only runs on the success path (and on explicit cancel at 134).
- `mobile/lib/screens/home.dart:40-45` — `recover()` runs in `initState` only; popping back from `InspectionScreen` does not re-run it.

**Repro A (isolation)** — User A taps the camera on the shared tablet; Android kills the app while the camera activity is foregrounded (the exact case `retrieveLostData` exists for). A's offline session lapses; user B logs in — the "dois usuários no mesmo tablet" scenario in `OFFLINE_SYNC.md:25`. B taps the camera on any item of any inspection: `inspection.dart:119-123` throws and tells B to fetch A. B cannot photograph a single critical finding until A logs back in on that device.

**Repro B (same user)** — Capture a photo that fails `preserve()` (>15 MiB, `photos.dart:26-30`, or non-JPEG/PNG magic bytes at `photos.dart:39-41`). Line 137 throws before line 144 clears the marker. Every later capture in that session throws the same message; it only self-heals on a full app restart.

**Smallest correction** — Key the marker per owner (`'camera|$owner'`), have `capture` check only its own owner's key, and clear the marker in the failure path once `pickImage` has returned (at that point `retrieveLostData` has nothing left to recover, so keeping it protects nothing).

**Regression test** — (a) Write a `camera` marker for owner A, switch the session to owner B, assert `capture` proceeds for B and A's marker survives for A's own recovery. (b) Make `preserve` throw and assert the marker is cleared so the next capture is allowed.

---

## HIGH 4 — Web "Load more" sends an `offset` the API silently ignores; older history is unreachable while the UI promises more

**Evidence** — `admin-web/src/pagination.tsx:22-27` requests `limit=100&offset=<n>`. `backend/.../InspectionQueryService.cs:15-39` accepts `limit` only — there is **no `offset` parameter anywhere in the backend** (grep: only the contract, the ledger, and `tests/integration/api-smoke.mjs:233-237` mention it). `InspectionEndpoints.cs:14-21` likewise.

**Repro** — Vehicle with 150 inspections. Open `/inspections`, click "Carregar mais registros". Page 2 returns the same newest 100 rows; `uniqueRows` (`pagination.tsx:9-11`) dedupes them away, so the count stays at 100 while `getNextPageParam` (`nextOffset`, page length === 100) keeps `hasNextPage` true. The button offers "more" forever and the 50 older records are unreachable. `Inspections.tsx:181-185` tells the operator the opposite.

Also: ordering is `StartedAt DESC, ReceivedAt DESC` (`InspectionQueryService.cs:36-37`), not the contract's `startedAt DESC, id DESC` (`IMPLEMENTATION_CONTRACT.md:68`). `ReceivedAt` is not unique, so once `offset` is added, ties can drop or duplicate records across pages — silent history loss.

This is ledger #10, still unimplemented in code; the infinite-"Load more" symptom and the tiebreak mismatch are new. Not a duplicate of a fixed item — I verified against current source.

**Smallest correction** — Add `offset` (default 0, reject negatives with 400 as the smoke test expects) and make the tiebreak `ThenByDescending(i => i.Id)`; same for audit.

**Regression test** — API: 3 records, `limit=1&offset=1` returns the middle record, `offset=-1` → 400, and two records sharing `startedAt` are returned exactly once across pages. Web: `usePaged` against a stub returning a short second page stops offering "Carregar mais".

---

## MEDIUM 5 — A superseded report loses its correction banner once the correction falls outside the newest 100 records for that vehicle

**Evidence** — `admin-web/src/pages/Inspections.tsx:221-229` fetches `/inspections?vehicleId=…` with **no limit and no paging**, and `:241-242` derives `corrections` by filtering that single page. The server caps it at `DefaultLimit = 100` (`InspectionQueryService.cs:12,18`). There is no `supersededByInspectionId` on `InspectionDto` (`Dtos.cs:72-91`), so the client has no other way to know.

**Repro** — Vehicle 714: inspection X finalized, corrected by Y (`supersedesInspectionId = X`). Record 100+ more inspections on that vehicle so Y is no longer in the newest 100. Open `/inspections/X`: the "Esta inspeção possui N correção(ões)" notice at `:295-305` disappears. The superseded record now reads as authoritative, including for an Office user who has no audit link (`:317`).

**Smallest correction** — Have the server project `supersededByInspectionId` (it already resolves the relationship in `InspectionSyncService.cs:575-583`) and render the banner from it. Client-only fallback: query the corrections explicitly rather than scanning a truncated window.

**Regression test** — Web: report for X with the correction absent from the mocked history page still shows the correction notice. API: `GET /inspections/{X}` exposes the superseding id.

---

## MEDIUM 6 — The session owner key embeds the server origin, so changing the server URL silently orphans preserved work

**Evidence** — `mobile/lib/data/session.dart:37-38`: `owner = '$server|${user.id}|${user.companyId}|${user.locationId}'`. Every store read filters on the exact string: `drafts` (`database.dart:148-153`), `queue` (`:162-166`), `photos` (`:255-263`), and the `declared|$owner|…` cache (`:224`).

**Repro** — Inspector has unsynced drafts, an outbox and pending photos against `https://oficina-antiga.exemplo.jp`. The workshop moves to a new hostname (staging→production, or a domain change). The inspector logs in at the new URL: Home shows "Nenhum rascunho neste usuário", the queue shows nothing, the photo list is empty, and nothing ever syncs. The bytes and rows are still on disk — `AGENTS.md`/`OFFLINE_SYNC.md:17` are satisfied literally — but the work is invisible with **no indication that it exists**, which reads to the user as data loss.

I checked the narrower triggers and they do not apply today: role changes force a re-login but role is not in the key, and `UserAdminService` never mutates `LocationId` (`UserAdminService.cs:54,173` — create only), so a location transfer is not currently reachable via the API. The realistic trigger is the origin, and `normalizeServer` (`api.dart:8-22`) already normalises case, trailing slash and default port, so only a genuine host change trips it.

**Smallest correction** — Do not delete or migrate anything. Add an explicit signal: on Home/Queue, count rows whose `owner` differs from the current session and show "N registros pertencem a outra sessão/servidor deste tablet — contate o suporte antes de reinstalar", so preserved work is never invisible.

**Regression test** — Seed a draft + pending operation + photo under owner `https://a|…`, restore a session under `https://b|…` for the same user, assert the rows are untouched and the orphan count is reported.

---

## Checked and found sound (no finding raised)

- **Outbox coalescing and version chaining** — `database.dart:98-107` coalesces only a never-attempted, non-blocked tail; `claimNext` increments `attempts` inside a transaction *before* the send, so an operation that may have reached the server is never replaced. Matches `OFFLINE_SYNC.md:15`. The chain math (`serverVersion + pending.length`, minus one on coalesce) is correct across the crash/edit interleavings I traced.
- **Payload freezing** — `saveDraft` (`database.dart:66-70`), `attachPhoto` (`:270-275`) and `DraftEditor.edit/attach` (`editor.dart:30-34,104-108`) all deep-copy before the async transaction; the ledger's "snapshot before async lookup" item is genuinely applied.
- **Logout / user isolation** — `session.dart:160-166` keeps drafts, queue, photos and the bootstrap cache; `app.dart:26` re-keys `MaterialApp` on `generation`, so a logout from the sync engine tears down pushed routes rather than leaving a stale editor over another user's session. `sync.dart:40-43` re-checks generation *and* owner between operations.
- **Web token handling** — memory only, `credentials: "omit"`, `cache: "no-store"`, generation-guarded 401 (`api.ts:36-50,74-82`), `queryClient.clear()` on both logout and login (`auth.tsx:49-55,100`). No cross-user cache bleed on the paths I traced.
- **Report honesty** — `photoSummary` (`domain.ts:150-171`) requires both `photoUploadState === "Complete"` and `uploaded === declared`, and `InspectionReport` renders explicit placeholders for undelivered ids including the signature (`Inspections.tsx:374-379,564-574`). No falsely-complete inspection on this surface.
- **Backend `signaturePhotoId`** — not yet present anywhere in `backend/` (DTO, entity, sync). The mobile client already sends it; `SusumuJson` uses default unmapped-member handling, so it is skipped rather than rejected — no 400 today. I treated this as ledger #21 in flight, not a defect, per your scope note. Worth sequencing though: once a `requiresSignature` template exists, finalization hits `InspectionSyncService.cs:549-552` and lands in BLOCKER 1's dead end.