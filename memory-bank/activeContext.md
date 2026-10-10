# Active context

## Current phase
Phase 0: project setup (see docs/CLINE_PROMPTS.md).

## Key decisions
- Next.js + TypeScript single repo; no database; cases are folders.
- In-product agent: Cline SDK `Agent` with custom tools only (no shell, no network).
- Model via Cline API (`openai-compatible`, base URL https://api.cline.bot/api/v1). Dev model: free `minimax/minimax-m2.5`; demo model: `anthropic/claude-sonnet-4-6`.
- Coverage: Guwahati (GMC) -> Assam -> Central. Data in `data/*.json` with sources and `verified` flags.
- Deadlines and draft checks are deterministic TypeScript, not LLM.

## Next steps
- Phase 1: tools + tests.

## Open questions
- Confirm `verified: false` offices in data/authorities.json before the demo.
