# Common implementer brief — Phase 3 (SPEC impl)
Repo: C:/Users/molna/VSCodeRepos/systemone-microcircuit. SPEC = docs/SPEC.md (authoritative, ~1900 lines; don't read whole).
1. Read CLAUDE.md (repo root): find your task row → SPEC sections to read. Locate by heading: `grep -n "^### 2.4" docs/SPEC.md`, then Read with offset/limit.
2. Always read: §0.3 Glossary, §5.2 Module interfaces (your modules' signatures EXACT), §7.2 rows for your U-IDs, §7.4 matrix rows for your FR IDs, §10 "Determinism requirements", §8.2 your row (owned files).
3. Write ONLY files your task owns (§8.2 "Files touched"). Other modules exist already from earlier tasks → import them, don't edit. Missing/incompatible interface → BLOCKED.
4. NO git commands that write (no add/commit/stash/checkout). NO edits to .agent/TASKS.md / PROGRESS.md. Controller commits.
5. Style: ES modules, relative imports w/ `.js`, no deps, no bundler. core/ + jev/ DOM-free (FR-ARCH-02). Min code that meets spec; no extras.
6. Verify: `node --test "tests/unit/*.test.mjs"` (Node ≥22, quoted glob) — your tests green, no regression in others. UI files: `node --check <file>`.
7. Secrets: never real keys; fixture keys contain `FAKE`. Tests never read TYPESAFE_API_KEY (except live-real test, T09).
8. Spec contradiction / ambiguity blocking correctness → stop, report BLOCKED w/ section refs. Minor ambiguity → pick simplest reading, record in report "Rulings".
9. Report → `.agent/reports/<task-id>.md`: files written, test results (counts), rulings, open issues. Reply ≤10 lines: status (DONE/BLOCKED), files, test counts, blockers.
Terse caveman style in report.
