# Haq project rules for Cline

## Stack
- Next.js (App Router) + TypeScript, Node 22+. Tailwind for styling.
- Cline SDK (`@cline/sdk`) for the in-product caseworker agent; `zod` for tool schemas; `vitest` for tests.
- No database. Each case is a folder under `cases/<caseId>/`; `cases/index.json` lists cases.
- Read `docs/SPEC.md` and `memory-bank/` before planning any task.

## Hard rules
1. The agent may only use data from `data/authorities.json` and `data/laws.json` for offices, laws, fees, portals and deadlines. Never hard-code or invent these in prompts or UI.
2. Deadlines are computed by `lib/tools/calcDeadlines.ts` (pure TypeScript), never by the LLM.
3. Draft checks are done by `lib/tools/checkDraft.ts` (pure TypeScript, deterministic), never by the LLM.
4. Agent file tools (`read_case_file`, `write_case_file`) must be scoped to `cases/<caseId>/`. Reject `..`, absolute paths and anything outside the folder. The agent gets no shell and no network tools.
5. All model access goes through `lib/agent/model.ts`. Model id and API key come from env (`CLINE_API_KEY`, `HAQ_MODEL`). Never commit keys.
6. The agent system prompt lives in `prompts/caseworker.md`. Do not inline long prompts in code.
7. No personal data in prompts beyond what the user typed. Drafts use `[Your name]`, `[Your address]`, `[Your phone]` placeholders.
8. Never add features that auto-file, submit forms or pay on government portals.
9. Every tool in `lib/tools/` has a vitest test. Run `npm test` before marking a task done.
10. Keep the UI simple and mobile-first. Large text, clear buttons, works at 375px width.

## Workflow
- Use Plan mode first for each phase in `docs/CLINE_PROMPTS.md`; wait for approval; then Act.
- After each phase: update `memory-bank/activeContext.md` and `memory-bank/progress.md`, then commit with a clear message.
- Prefer small files and clear names over clever abstractions. This is an 8-hour build.
