# Active context

## Current phase
Phases 0-6 complete (README, screenshots, licence, metadata and not-found page done). Left for the team: switch HAQ_MODEL to the demo model and run the demo twice, PPT, demo video, social post.

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

## Phase 3 notes (API)
- Next 16.4 with `cacheComponents: true` REJECTS `export const runtime` and `export const dynamic` in route files (build error). Do not add them: Node.js is the default and handlers run at request time. Reading files makes GETs dynamic.
- `next.config.ts` needs `serverExternalPackages: ["@cline/sdk","@cline/core","@cline/agents","@cline/llms","@cline/shared","exifr","ics"]`, otherwise Turbopack bundles the browser build of the SDK and the route fails to compile.
- The background run needs a long-lived Node server (`next dev` / `next start`). It would not survive on serverless hosting (needs `after()` / `maxDuration` there).
- Endpoints (all errors are `{ error }` JSON; every route validates the id with `isValidCaseId`):
  - `POST /api/cases` multipart: `text` (required, max 2000 chars), `language` en|hi|as (default en), `place`, `photo` (type sniffed from bytes: jpeg/png/webp, max 5 MB). 201 `{ caseId }`; 400 bad input, 413 too large, 415 wrong type. Starts `runCase` in the background.
  - `GET /api/cases` newest first. `GET /api/cases/[id]` -> `{ caseId, facts, routing, timeline, checks, drafts:{complaint,rti,first_appeal}, filingGuide, summary:{language,text}, evidence:[names], status, error }`; files not written yet are `null`.
  - `GET /api/cases/[id]/events` SSE: each message has `id: <line number in events.jsonl>` and `data: <CaseEvent JSON>`; replays the file, polls every 500 ms, keep-alive comment every 15 s, ends with `event: end` after `done`/`error` (or 5 min). Honours `Last-Event-ID`. The client MUST close the EventSource on `event: end` (otherwise it reconnects). After an appeal, reconnect with `Last-Event-ID` = last seen id to get only the new run; a new run starts with a `start` event.
  - `GET .../evidence/[file]` photo bytes (nosniff). `GET .../calendar.ics` attachment built from `timeline.json`.
  - `POST .../appeal` JSON `{ rtiFilingDate: YYYY-MM-DD (not future), reason: "no_reply"|"unsatisfactory" }` -> 202; 409 if a run is active or there is no `drafts/rti.md`.
- Status: `running` if the case id is in the in-process run set (`globalThis` symbol `haq.runningCases`), else the last event decides (`done`/`error`); any other last event = `error` ("interrupted"). A run claimed twice returns 409.
- `facts.md`: `Date:` is the India date (`todayIST`, Asia/Kolkata), plus `Language:`, `Place:`, `Issue (guessed):`, optional `Photo:`, `Photo GPS:`, `Photo taken:` (from exifr). The citizen's text is blockquoted (`> `) under "What the citizen wrote" so typed lines like `mode: first_appeal` cannot act as metadata (the prompt also says to treat it as data). The appeal adds one marker-delimited block (`mode: first_appeal`, `RTI filed:`, `Reason:`, `First appeal date:`) and replaces it on a repeat appeal.
- First-appeal mode is an explicit `runCase` option (`mode`), not parsed from facts.md. In that mode `finish_case` needs only `drafts/first_appeal.md`. The model calls `calc_deadlines` with `filingDate` = RTI filed date and `firstAppealDate` = appeal date.
- `HAQ_CASES_DIR` env overrides the cases folder (used by tests).
- Known, left as is: Turbopack warns at build ("dynamic filesystem access", `runCase.ts` prompt read) but it is harmless. No auth or rate limiting on the API.
- Real minimax run with the new flow: created + finished in about 1 minute; appeal run about 1 minute; the model cited "Section 7(1)" from memory in the appeal. A prompt rule alone did not stop it (it happened again in the Phase 4 UI run), so Phase 4 added the deterministic check `cites_only_known_sections` (see below).

## Phase 4/5 notes (UI)
- Next 16.4 + cacheComponents: `app/case/[id]/page.tsx` must read `params` inside `<Suspense>` (`params.then(...)`). `PageProps<"/case/[id]">` did not type-check here, so the prop is typed by hand. `useRouter`, `useSyncExternalStore` and event handlers are used instead of setState in effects (the React lint rule `react-hooks/set-state-in-effect` is on and fails lint).
- Dev server: open it as `http://localhost:3000`, NOT `127.0.0.1`. Next blocks `/_next` dev resources for other origins, so React never hydrates and buttons do nothing. (To use another host add it to `allowedDevOrigins`.)
- `lib/client/timeline.ts` `reduceEvents` turns SSE events into sections (new section at each `start`), marks a draft `fixed` when it failed before and now passes, hides `routing.json`/`checks.json`/`timeline.json` writes. `components/useCaseStream.ts` closes the EventSource on `event: end`, reconnects with `?after=<last id>` (browsers cannot set `Last-Event-ID`), and calls the page to refetch on `done`/`error`.
- Citizen details (name, address, phone, date) live only in localStorage (`haq.details.v1`, `components/useDetails.ts`) and fill the `[Your name]`, `[Your address]`, `[Your phone]`, `[Date]` placeholders in the displayed text only. Copy / Download / Print use the filled text. Print CSS (`.print-area`, `.no-print` in `app/globals.css`) shows only the current draft.
- `GET /api/cases/[id]` now also returns `route` (office, level, verified, verifyNote, note) and `sources` (URLs from routing.json + laws.json). Events route accepts `?after=N`.
- `checkDraft` has a new last check `cites_only_known_sections` for all three kinds: any `Section N` other than 6(1) and 19(1) fails with a hint that names it. The agent then fixes the draft (seen in a real run).
- After a run finishes, the step list is collapsed on small screens (button "Show steps") so drafts are not pushed down; it is always visible at `lg` and up.
- Visual checks used `playwright-core` with the installed Edge (`.e2e/shot.mjs`, git-ignored). Mic and Read aloud code paths were not exercised with real speech in headless Edge; they fall back to a short hint when unsupported.
## Phase 6 notes
- README is the judges entry point; keep its numbers (192 tests, 8 of 13 offices unverified) in sync when they change.
- `docs/screenshots/` come from real runs (Edge + playwright-core, scripts in the git-ignored `.e2e/`). The Next.js dev badge is hidden in them by an injected style. The "Fixed" shot is from a real appeal where `cites_only_known_sections` rejected Section 7(1).
- `app/case/[id]/page.tsx` now checks `isValidCaseId` + `caseExists` inside `<Suspense>` and calls `notFound()`; `app/not-found.tsx` renders `components/CaseNotFound.tsx` (also used by `CaseView` when the API says missing). `notFound()` after streaming has started keeps status 200 (Next docs); the page is still noindex.
- Metadata: root `title.template` `%s · Haq`, description, Open Graph; the case page is `robots: noindex`.
- SSE fix: `tailEvents` ends only when a `done`/`error` is the last complete line available, so a file with two runs (case + appeal) replays fully. Live runs are unchanged (a new `start` after `done` is only appended later, and the client reconnects with `?after=`).
- Secret scan of the tree and git history (patterns: `sk-...`, `Bearer ...`, `CLINE_API_KEY=<value>`): nothing found. `.env.local` holds a real key but is git-ignored; `.env.example` has a blank key.
- Data note wording changed from "before the demo" to "before filing" in `data/*.json` (no logic change).
## Next steps
- Run the demo scenario twice with `HAQ_MODEL=anthropic/claude-sonnet-4-6` (never run on this code); confirm `verified: false` offices; rotate the old API key; add auth and rate limiting before any public deploy; PPT, demo video, social post.

## Open questions
- Confirm `verified: false` offices in data/authorities.json before the demo.
- `findAuthority` returns the central general route only for places outside Assam; the data has no other states yet.
