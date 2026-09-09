# SUSUMU VEHICLE CHECK — shared engineering rules

Read `docs/source/PROMPT_MESTRE_2026-09-09.txt`, `docs/IMPLEMENTATION_CONTRACT.md`, and the current implementation plan before changing code. The user authorized complete implementation, cross-review with Claude Code, and final private GitHub publication on 2026-09-09. Do not stop for routine reversible engineering choices. No purchases, production data, VPS changes, or production deployment are authorized.

Claude Code leads backend implementation and joins architecture/reviews; Codex coordinates integration and independently reviews. Other workers have exclusive path ownership. Never overwrite another worker's files or change branches, reset, clean, force-push, or commit someone else's work. Root coordinator handles commits and remote publication. Do not access credentials outside normal authenticated tooling, print secrets, or commit secrets, generated runtime data or photos.

Use Flutter/Dart/Drift, ASP.NET Core .NET 10/EF Core, PostgreSQL 18, React/TypeScript. Offline durability and authorization are mandatory. Preserve photo originals and finalized inspection history. Use versioned migrations. All business-rule changes need meaningful tests. Tests must fail before implementing new behavior where feasible. Use synthetic data only in DEV fixtures. Record limitations honestly; a working emulator/build is not a physical-tablet test.

Source of truth: repository documents and reviewed code. Document architectural rulings in `decisions/`. See `docs/IMPLEMENTATION_CONTRACT.md` for interfaces. Raise interface changes to the root coordinator before applying them.
