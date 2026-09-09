# SUSUMU VEHICLE CHECK — shared engineering rules

## Canonical workspace — explicit relocation by Wagner, 2026-09-10

The only project root on this PC is `C:\Users\Pc Forex 2025\OneDrive - 株式会社ススム\Particular\CODEX\_GPT`. Wagner explicitly requested moving 100% of the project (including private DEV files and Git history) into this OneDrive folder and removing the previous `C:\Dev\SusumuVehicleCheck` directory, with no junction, alias or fallback there. Deletion is currently blocked by automatic tool policy; the old copies still exist and must not receive new work. This overrides historical guidance to develop outside OneDrive. Always use the new root, quote paths, and derive runtime paths from the repository. Shared SDK installations in `C:\Dev\tools` are external prerequisites, not part of the project directory. On another PC locate the synced root and install the documented toolchain. Never run the same PostgreSQL data directory on two PCs; keep services stopped while transferring its synced copy. Local placement/pinning does not establish completed cloud synchronization.

## Current user instruction — 2026-09-10: local browser demonstration

Wagner explicitly authorized building and testing a local Windows/Chrome demonstration of the Tenken tablet flow with mouse controls, in collaboration with real Claude Code. This supersedes the documentation-only restriction ONLY for this demonstration and its tests, documentation and local launcher. Preserve Android/backend implementation; no production deployment or production data. Use synthetic fixtures and clearly identify simulated server actions. The Android product and physical tablet pilot remain separate and are not newly authorized for development. Root owns demo UI/integration; Claude owns demo domain model and domain tests as assigned. No worker commits or switches branches.

## Previous user instruction — documentation-only sketch

Wagner explicitly requested that Codex and Claude Code work only on the complete sketch, with tests and subtests, and **not program anything yet**. This supersedes the earlier implementation authorization below for the current phase. Preserve the existing V1. Write/review design documents, screen sketches, conceptual scenarios and acceptance criteria only. Do not change application source, executable tests, dependencies, schemas, infrastructure configuration or runtime; do not execute builds, migrations, application tests or deployments. The pilot uses one purchased Galaxy Tab Active5 Pro Wi-Fi. New implementation requires a new explicit user instruction. Record test scenarios as planned, never as executed or passed in this design phase.

## Previous implementation baseline (historical)

Read `docs/source/PROMPT_MESTRE_2026-09-09.txt`, `docs/IMPLEMENTATION_CONTRACT.md`, and the current implementation plan before changing code. The user authorized complete implementation, cross-review with Claude Code, and final private GitHub publication on 2026-09-09. Do not stop for routine reversible engineering choices. No purchases, production data, VPS changes, or production deployment are authorized.

Claude Code leads backend implementation and joins architecture/reviews; Codex coordinates integration and independently reviews. Other workers have exclusive path ownership. Never overwrite another worker's files or change branches, reset, clean, force-push, or commit someone else's work. Root coordinator handles commits and remote publication. Do not access credentials outside normal authenticated tooling, print secrets, or commit secrets, generated runtime data or photos.

Use Flutter/Dart/Drift, ASP.NET Core .NET 10/EF Core, PostgreSQL 18, React/TypeScript. Offline durability and authorization are mandatory. Preserve photo originals and finalized inspection history. Use versioned migrations. All business-rule changes need meaningful tests. Tests must fail before implementing new behavior where feasible. Use synthetic data only in DEV fixtures. Record limitations honestly; a working emulator/build is not a physical-tablet test.

Source of truth: repository documents and reviewed code. Document architectural rulings in `decisions/`. See `docs/IMPLEMENTATION_CONTRACT.md` for interfaces. Raise interface changes to the root coordinator before applying them.
