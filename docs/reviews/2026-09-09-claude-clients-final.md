# Final verification — residual HIGH only

Read-only. I read `docs/reviews/2026-09-09-claude-clients-round2.md`, `mobile/lib/data/camera.dart`, `mobile/lib/data/photos.dart` (helpers used by the fix), `mobile/lib/data/recovery.dart`, `mobile/lib/screens/home.dart` (warning surface), `mobile/test/camera_test.dart` and `mobile/test/recovery_test.dart`.

**I ran nothing.** The 57-test pass, clean analyzer and APK at 23:21 JST are the mobile author's report; I neither confirm nor dispute them. Tests below are cited as written coverage only.

## Verdict: residual HIGH is **RESOLVED in source**

The terminal symptom I raised — a journaled path whose file is gone permanently blocking `_drain`, and therefore every user's camera — is gone. `camera.dart:202` is now reachable on the missing-source path, so the global journal clears.

### 1. Definitive-missing vs permission vs target-write — correctly separated

- `photos.dart:11-13` `fileIsDefinitivelyMissing` accepts only ENOENT (`errorCode == 2`), plus Windows `3`; the comment states permission/generic I/O must never discard an entry.
- `camera.dart:146-147` — only a `FileSystemException` on the **source** read that satisfies that predicate is diagnosed; everything else `rethrow`s into the outer `catch (_)` at `:194-199`, which keeps the journal and the "aguarda preservação" StateError.
- Target-write failure is unchanged: `photos.preserve`/`quarantine` failures still fall through to `:194`, so the space-exhaustion guarantee holds.
- Coverage: `camera_test.dart:52-77` (errno 13/Windows 5 → `throwsStateError`, journal `paths` retained, `camera-diagnostics|A` still null, source file untouched); `:178-212` (blocked target retains the path, later succeeds without consuming lost data).

### 2. Durable artifact salvaged before declaring absence

`camera.dart:132-142` calls `photos.findPreserved` **before** `readSource`. `photos.dart:24-65` matches on the deterministic id + extension, validates `id/inspectionId/itemId/kind == Original` against the sidecar, verifies both `sizeBytes` and SHA-256, and rethrows non-missing `FileSystemException` (`:60-61`) so a permission error cannot masquerade as "not preserved". A capture that was preserved before the journal was cleared is therefore recovered, not diagnosed. Coverage: `camera_test.dart:146-176` — artifact and path returned, `warning` null, no diagnostics written, journal cleared.

### 3. Deterministic indices retained

`camera.dart:125-131` computes `Uuid().v5(captureId, '$index')` for every slot and `continue`s on a known-missing index instead of removing it, and `:150-151,170` persists `missingIndices` in the journal. A later entry keeps its original index, so no id shifts. Coverage: `camera_test.dart:79-110` — after a target failure the journal shows `missingIndices == [0]`, and the retry preserves index 1 under exactly `v5(captureId, '1')`, with one diagnostics entry and the journal cleared.

### 4. Owner privacy preserved

Diagnostics are keyed `camera-diagnostics|$owner` (`camera.dart:155`) and read only under the current owner (`recovery.dart:56-64`). `capture` merges a prior drain's warning only when `previous?.owner == owner` (`camera.dart:82-88`), so B never sees A's warning; the warning strings themselves carry no owner, path, inspection or item. Journal advancement and the diagnostic row commit in one `db.transaction` (`camera.dart:154-171`) under A. Coverage: `camera_test.dart:112-144` — A's entry records the path privately, `camera-diagnostics|B` is null, B's subsequent capture returns `warning: null` and only B's artifact.

### 5. Global blockade cleared

Same test: `db.cached('camera')` is null after the missing-source drain and B captures successfully. The clear happens at `camera.dart:202` after the loop completes.

### 6. Per-artifact orphan continuation — also resolved

`recovery.dart:30-35` now appends to `warnings` and `continue`s instead of throwing, and `:40-43` catches per-artifact attach failures. Files are never deleted. Coverage: `recovery_test.dart:13-53` — with one linkable, one draft-missing and one finalized artifact, `recoverFiles()` returns 1, two warnings are collected, and all three files remain recoverable. Warnings reach the operator via `home.dart:62-68`, with camera failures isolated at `:55-59` so a camera error no longer aborts file recovery; `home.dart:137` re-runs recovery on return from an inspection, which also closes my round-1 note that recovery only ran at app start.

## Remaining concerns

**No blocker.** One non-blocking observation, stated for the record and not requiring redesign:

- `camera-diagnostics|$owner` is written (`camera.dart:155-169`) and read (`recovery.dart:58-64`) but never cleared anywhere in `lib/`. The "N captura(s) … ficaram sem arquivo recuperável" line is therefore cumulative and permanent for that owner: it reappears on every Home load and after each inspection, and the count does not fall once the operator has retaken the photos. Honest, private and harmless to data, but non-dismissible. Smallest fix if you want it: record an acknowledged marker (or move acknowledged entries to a separate key) when the operator has seen the notice, leaving the entries themselves preserved for support.

## Position

All five previously reviewed client issues (1, 2, 3, 5, 6) are resolved in source, and the residual HIGH I raised in round 2 is closed with directly matching written coverage. I have not observed a green run of any suite; final delivery remains gated on real API integration and GitHub CI, as you specified.
