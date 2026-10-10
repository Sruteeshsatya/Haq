# Active context

## Current phase
Phase 1 complete (deterministic tools + tests). Phase 0 `npm run ping` still unverified with a real key. Next: Phase 2 (caseworker agent).

## Key decisions
- Next.js + TypeScript single repo; no database; cases are folders.
- In-product agent: Cline SDK `Agent` with custom tools only (no shell, no network).
- Model via Cline API (`openai-compatible`, base URL https://api.cline.bot/api/v1). Dev model: free `minimax/minimax-m2.5`; demo model: `anthropic/claude-sonnet-4-6`.
- Coverage: Guwahati (GMC) -> Assam -> Central. Data in `data/*.json` with sources and `verified` flags.
- Deadlines and draft checks are deterministic TypeScript, not LLM.

- Place routing (`findAuthority`): empty place -> assumed Assam (state level, `verified:false`, note "Place not given; assumed Assam."); place in a city's `match_places` -> city, else in `state.assam.assam_places` -> Assam state; any other place -> central only. Uncovered issue: Assam/empty -> `state.other_state_service`; outside Assam -> `central.other_central_service` plus the "Your state is not covered yet..." note. Matching is whole-word for Latin text, substring for Hindi/Assamese.
- Deadlines (`calcDeadlines`): day 0 = RTI filing date. Reply day 30; first appeal assumed filed day 30 so window ends day 60, FAA decision due day 60 (max 45 days -> day 75 in the explanation), second-appeal window ends 90 days after FAA due date. Optional `firstAppealDate` moves FAA and second-appeal dates. Grievance dates use the same filing date. Offices with no verified deadline (e.g. `assam_cm_grievance`) get no event. RTI day counts live under `rti_act_2005.rules` and apply to `rti_central` and `rti_assam`.
- `checkDraft(kind, text, { hasEvidence = false })`: the complaint annexure check passes unless evidence exists. Location check is a heuristic (known places or words like ward/road/lane/PIN).
- `caseFiles` functions take an optional last `root` argument (default `<cwd>/cases`); `caseId` must match `[A-Za-z0-9_-]+`.
- `.env.example` is committed with a blank `CLINE_API_KEY=`. The earlier file held a real-looking key (never committed); consider rotating it.

## Next steps
- Phase 2: `lib/agent/runCase.ts` wraps these tools with the Cline SDK (`ISSUE_TYPES` and `LAW_KEYS` in `lib/tools/data.ts` are ready for the zod enums).

## Open questions
- Confirm `verified: false` offices in data/authorities.json before the demo.
- `findAuthority` returns the central general route only for places outside Assam; the data has no other states yet.
