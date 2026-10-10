# Progress

## Done
- Test runner: `npm test` (vitest run).
- `cases/` dir with `.gitkeep` + `index.json` (`[]`); other case files and `.env.local` gitignored.
- `lib/agent/model.ts`: `getModelConfig()` -> openai-compatible @ https://api.cline.bot/api/v1, key `CLINE_API_KEY`, model `HAQ_MODEL` (default `minimax/minimax-m2.5`).
- `scripts/ping-model.ts` (`npm run ping`): runs a Cline SDK `Agent` and prints a one-line reply to verify the key.

## Next
- Run `npm install`, set `CLINE_API_KEY` in `.env.local`, run `npm run ping`.
- Note: `.clinerules/`, `docs/SPEC.md`, `data/*.json` and the rest of memory-bank were not present in the repo at this point.
