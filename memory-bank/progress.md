# Progress

| Phase | Status | Notes |
|---|---|---|
| 0 Setup | done (key unverified) | `npm test` script, `cases/`, `.gitignore`, `lib/agent/model.ts`, `scripts/ping-model.ts` (`npm run ping`). Run ping with `CLINE_API_KEY` in `.env.local` to confirm. |
| 1 Tools + tests | done | `lib/tools/` (`findAuthority`, `guessIssueType`, `lookupLaw`, `calcDeadlines`, `toIcs`, `checkDraft`, `caseFiles`, shared `data.ts`/`text.ts`) + `tests/*.test.ts`. `npm test`: 82 tests pass; `tsc --noEmit` clean. `.env.example` is now committable (key blank). Added `assam_places` to `data/authorities.json`. |
| 2 Caseworker agent | not started | |
| 3 API + streaming | not started | |
| 4 UI | not started | |
| 5 Appeal + extras | not started | |
| 6 Polish, README, demo | not started | |
