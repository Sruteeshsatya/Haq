# Build Haq with Cline — phase-by-phase prompts

**How to use:** For each phase, open a NEW Cline task, switch to **Plan mode**, paste the prompt, review Cline's plan, then switch to **Act mode**. Approve each step. When the phase works, commit.

**Record everything:** keep a screen recorder (OBS / Xbox Game Bar `Win+Alt+R` / macOS `Cmd+Shift+5`) running during Cline sessions. The demo video must show Cline in action. Save 3-4 short clips: Plan mode for Phase 2, Act mode writing tools, tests passing, a checkpoint rollback.

**Time budget (8 h):**

| Phase | Time | Owner (suggested) |
|---|---|---|
| 0 Setup | 0:00-0:30 | everyone |
| 1 Tools + tests | 0:30-1:45 | Dev A |
| 2 Caseworker agent | 1:45-3:15 | Dev A |
| 3 API + streaming | 3:15-4:00 | Dev B |
| 4 UI | 2:00-5:00 (parallel) | Dev B / Dev C |
| 5 Appeal + extras | 5:00-6:00 | Dev A |
| 6 Polish, README, PPT, demo video | 6:00-8:00 | everyone |

Model for Cline (building): your Cline account. Model inside Haq: Cline API key from app.cline.bot → Settings → API Keys, put in `.env.local`.

---

## Phase 0 — Setup (do by hand + Cline)

By hand:
```bash
npx create-next-app@latest haq --ts --tailwind --app --eslint --src-dir=false --import-alias "@/*"
cd haq
# copy the starter pack into the repo root: .clinerules/ memory-bank/ data/ docs/ prompts/ .env.example
npm i @cline/sdk zod exifr ics
npm i -D vitest
npx skills add cline/sdk-skill      # gives Cline context on the Cline SDK
cp .env.example .env.local          # add your CLINE_API_KEY
git init && git add . && git commit -m "Setup: Next.js + Haq starter pack"
```
Push to a **public** GitHub repo.

Cline prompt:
```
Read .clinerules/, memory-bank/, docs/SPEC.md and data/*.json.
Add "test": "vitest run" to package.json scripts, create cases/.gitkeep and cases/index.json ([]),
add cases/* (except .gitkeep and index.json) and .env.local to .gitignore.
Create lib/agent/model.ts exporting getModelConfig() that returns
{ providerId: "openai-compatible", baseUrl: "https://api.cline.bot/api/v1",
  apiKey: process.env.CLINE_API_KEY, modelId: process.env.HAQ_MODEL ?? "minimax/minimax-m2.5" }.
Make a tiny script scripts/ping-model.ts that runs a Cline SDK Agent with this config and prints a one-line reply,
so we can confirm the key works. Update memory-bank/progress.md.
```

---

## Phase 1 — Deterministic tools + tests

```
Plan, then build lib/tools/ with pure TypeScript functions plus vitest tests (tests/*.test.ts).
Use ONLY data/authorities.json and data/laws.json. No LLM calls in this phase.

1. findAuthority(issueType, place): issueType is one of the keys of issue_keywords.
   Routing: if place matches a city's match_places and the city has the issue -> city level;
   else if the state (Assam) has the issue -> state level; else if central has it -> central;
   else return { covered: false, generalRoute: state.other_state_service or central.other_central_service }.
   Return { covered, level, office, grievanceKey, rtiKey, rtiPio, verified, verifyNote?, sources }.
   Also export guessIssueType(text) using issue_keywords (case-insensitive, works for Hindi/Assamese words).
2. lookupLaw(key): returns the object from laws.json or { found: false }.
3. calcDeadlines(route, filingDate): route is { grievanceKey, rtiKey }. Use day counts from laws.json
   (redressal_days, acknowledgement_days, reply_deadline_days, first_appeal_window_days,
   first_appeal_decision_days, second_appeal_window_days). Return a sorted list of
   { date (YYYY-MM-DD), label, kind: "grievance"|"rti"|"appeal" , explanation }.
   Also export toIcs(events) using the "ics" package.
4. checkDraft(kind, text): kind = "complaint" | "rti" | "first_appeal". Return
   { passed, checks: [{ id, label, passed, hint }] }. Checks:
   - rti: word count <= 500; addressed to "Public Information Officer"; mentions "Section 6(1)";
     mentions fee "₹10"/"Rs. 10"/"Rs 10" or "BPL"; has 3+ numbered requests; no request starting with "Why";
     mentions a time period (a year or "from ... to"); contains [Your name] and [Your address] placeholders.
   - complaint: has "Subject:"; mentions location; mentions since when (a date, month or "since");
     has a specific request ("request"/"kindly"); references an annexure or "photo" when evidence exists (pass if no evidence);
     contains [Your name] and [Your phone]; <= 400 words.
   - first_appeal: mentions "Section 19(1)"; addressed to "First Appellate Authority";
     mentions the original RTI date or reference; states the ground (no reply within 30 days / unsatisfactory reply).
5. caseFiles.ts: safeCasePath(caseId, relPath) that rejects "..", absolute paths and anything outside
   cases/<caseId>/; readCaseFile, writeCaseFile (creates folders), listCaseFiles.

Write good and bad example drafts in tests to prove each check. Run npm test until all pass.
```

---

## Phase 2 — The caseworker agent (Cline SDK inside the product)

```
Plan, then build lib/agent/runCase.ts using the Cline SDK (see the sdk-skill and
https://docs.cline.bot/sdk/guides/creating-custom-tools.md and https://docs.cline.bot/sdk/events.md).

- Wrap each Phase 1 function as a Cline SDK tool with createTool and a zod inputSchema:
  read_case_file, write_case_file, find_authority (issue_type as z.enum of issue keys, place),
  lookup_law (key as z.enum of laws.json keys), calc_deadlines, check_draft (kind enum, path),
  and finish_case with lifecycle: { completesRun: true }.
  Tools are created per case (closure over caseId) so file access is scoped to that folder.
  Return errors as { output: { error }, isError: true } instead of throwing.
- Create an Agent with getModelConfig(), tools = the list above, the system prompt from
  prompts/caseworker.md, and a sensible maxIterations (about 30).
- runCase(caseId, onEvent): subscribe to agent events and forward a simplified event stream:
  { type: "text" | "tool_call" | "tool_result" | "file_written" | "check" | "done" | "error", ...}.
  Emit "file_written" from inside write_case_file and "check" from inside check_draft so the UI
  can show them reliably even if SDK event names differ.
- Append every event as one JSON line to cases/<caseId>/events.jsonl.
- Add scripts/run-case.ts that creates a sample case (pothole in Guwahati, Assamese text) and runs it,
  printing events. Run it and fix problems until drafts pass all checks.
```

---

## Phase 3 — API + live streaming

```
Plan, then build Next.js route handlers (runtime "nodejs"):
- POST /api/cases: multipart form (text, language "en"|"hi"|"as", place optional, photo optional).
  Create caseId (nanoid or timestamp), write facts.md (text, language, place, created date,
  guessed issue type) and evidence/photo-1.jpg. If the photo has EXIF GPS/date (exifr), add them
  to facts.md. Add to cases/index.json. Start runCase in the background. Return { caseId }.
- GET /api/cases/[id]/events: Server-Sent Events. First replay events.jsonl, then stream new events
  until "done".
- GET /api/cases/[id]: return the case's files (text content) and checks.
- GET /api/cases/[id]/calendar.ics: return toIcs(timeline).
- POST /api/cases/[id]/appeal: add "mode: first_appeal" and the RTI filing date to facts.md,
  run the agent again.
Test with curl.
```

---

## Phase 4 — UI (can start in parallel at 2:00 with mock data)

```
Plan, then build a clean, mobile-first UI with Tailwind. Use the frontend-design ideas:
calm civic look, large readable text, one accent colour, works at 375px.

1. app/page.tsx (Intake): title "Haq — हक़ — your right", one big textarea,
   language toggle (English / हिन्दी / অসমীয়া), a mic button using the browser
   SpeechRecognition API (lang en-IN / hi-IN / as-IN; hide if unsupported), optional place field,
   photo upload with preview, and a "Start my case" button. Two example chips that fill the textarea
   (pothole in Guwahati; post office parcel lost).
2. app/case/[id]/page.tsx (Case):
   - Left panel "Haq is working": live timeline from SSE — plan steps, each tool call with a short
     friendly label ("Finding the responsible office…"), files written, and check results as
     green ticks / red crosses that turn green after fixes.
   - Right panel tabs: Summary (in the user's language, with a "Read aloud" button using
     speechSynthesis), Complaint, RTI, Where to file, Timeline.
   - Drafts: rendered markdown, editable placeholders ([Your name] etc. become inputs that fill the text),
     Copy and Download (.txt/.md) buttons, and "Print / Save as PDF".
   - Timeline: vertical list of dates with labels, "Add to calendar" (.ics).
   - A "No reply yet? Draft first appeal" button after the RTI tab.
   - A routing badge: "City: Guwahati Municipal Corporation" / "State: Assam" / "Central".
     If verified is false, show an amber "Please confirm this office" note.
   - Footer: "Not legal advice…" line.
```

---

## Phase 5 — Appeal + extras (pick in this order)

```
1. Wire the first-appeal button end to end and show its checks live.
2. Show the photo in the Complaint tab as "Annexure 1" with EXIF date/location if present.
3. Add a "Sources" section to Where to file listing the source URLs from the data files.
4. Add a small "Cases" list on the home page from cases/index.json.
```

---

## Phase 6 — Polish and deliverables

```
1. Write README.md: problem, solution, demo GIF/screenshot, architecture diagram (mermaid),
   tech stack, setup steps (.env.local, npm i, npm run dev), how Cline was used
   (Plan/Act, .clinerules, Memory Bank, SDK skill, checkpoints, tests) and how Cline runs
   inside the product (Cline SDK agent + custom tools + live view), data sources, limitations, future scope.
2. Remove dead code, fix lint, make sure npm test passes.
3. Switch HAQ_MODEL to the demo model and run the demo scenario twice to be sure it is stable.
```
Then: PPT (problem, solution, architecture, models/tools, Cline in build + inside product,
challenges, future scope), demo video (2-3 min), social post tagging Cline.
