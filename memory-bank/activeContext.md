# Active context

## Current phase
Phase 2 complete (caseworker agent with the Cline SDK). `npm run ping` and `npm run run-case` work with the real key. Next: Phase 3 (API + live streaming).

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

## Phase 2 notes (Cline SDK, verified against @cline/* 0.0.92 types)
- `import { Agent, createTool } from "@cline/sdk"`. Agent options used: `providerId, modelId, apiKey, baseUrl` (from `getModelConfig()`), `systemPrompt`, `tools`, `maxIterations: 30`, `completionPolicy: { requireCompletionTool: true }`, `hooks.afterTool`. Tests inject `model: AgentModel` (a mock stream) instead of the provider fields. `agent.run()` does not throw: it returns `status` of `completed`, `aborted` or `failed`.
- Events used from `agent.subscribe`: `assistant-message` -> `text`, `tool-started` -> `tool_call`, `tool-finished` -> `tool_result`. `file_written` and `check` are emitted inside the tools. `done` is emitted only after `finish_case` is accepted.
- GOTCHA: the runtime wraps whatever `execute` returns as `output`, so returning `{ output, isError: true }` arrives nested and looks like success (it would even end the run for `finish_case`). `runCase` unwraps it in `hooks.afterTool` (`unwrapToolResult`). The SDK also does not enforce zod enums, so every tool re-validates with `safeParse` (`guarded`).
- Tools (`lib/agent/caseTools.ts`, created per case): `find_authority` writes `routing.json`, `calc_deadlines` writes `timeline.json`, `check_draft` records `checks.json`. The model cannot write those files, `evidence/**` or `events.jsonl`. Content cap 50k chars. `finish_case` re-runs `checkDraft` itself and refuses unless `drafts/complaint.md` and `drafts/rti.md` pass (and `first_appeal.md` if it exists).
- `facts.md` should contain `Language:`, `Place:` and `Date: YYYY-MM-DD`; the agent uses the Date line as `filingDate`.
- `runCase(caseId, onEvent, options)` never throws. Options: `root`, `promptPath`, `model` (mock), `maxIterations`, `timeoutMs` (default 4 minutes). Every event is appended to `cases/<caseId>/events.jsonl`. A missing key emits an `error` event.
- Scripts use `tsx` (`npm i -D tsx`) with `"type": "module"` in package.json. `ping` and `run-case` load `.env.local` via `tsx --env-file=.env.local`.
- Model note: free `minimax/minimax-m2.5` completed the flow in 2 of 2 real runs (about 1 minute each). Prompt v2 forbids inventing dates, payment methods and portals; run 1 had invented a payee and a date range that no tool returned.

## Next steps
- Phase 3: API routes + SSE (replay `events.jsonl`, then stream new events), using `runCase` and the `CaseEvent` types in `lib/agent/events.ts`.

## Open questions
- Confirm `verified: false` offices in data/authorities.json before the demo.
- `findAuthority` returns the central general route only for places outside Assam; the data has no other states yet.
