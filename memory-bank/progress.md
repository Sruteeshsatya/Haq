# Progress

| Phase | Status | Notes |
|---|---|---|
| 0 Setup | done (key unverified) | `npm test` script, `cases/`, `.gitignore`, `lib/agent/model.ts`, `scripts/ping-model.ts` (`npm run ping`). Run ping with `CLINE_API_KEY` in `.env.local` to confirm. |
| 1 Tools + tests | done | `lib/tools/` (`findAuthority`, `guessIssueType`, `lookupLaw`, `calcDeadlines`, `toIcs`, `checkDraft`, `caseFiles`, shared `data.ts`/`text.ts`) + `tests/*.test.ts`. `npm test`: 82 tests pass; `tsc --noEmit` clean. `.env.example` is now committable (key blank). Added `assam_places` to `data/authorities.json`. |
| 2 Caseworker agent | done | `lib/agent/runCase.ts` (Cline SDK `Agent`, 30 iterations, 4-minute timeout, `completionPolicy.requireCompletionTool`), `lib/agent/caseTools.ts` (7 per-case tools), `lib/agent/events.ts` (event types + `events.jsonl`), `scripts/run-case.ts`, prompt v2. `npm test`: 119 pass, `tsc` and eslint clean. Real run with free `minimax/minimax-m2.5`: completed the whole flow, both drafts passed all checks, in 2 of 2 runs (about 1 minute each). `npm run ping` now works (tsx). |
| 3 API + streaming | not started | |
| 4 UI | not started | |
| 5 Appeal + extras | not started | |
| 6 Polish, README, demo | not started | |
