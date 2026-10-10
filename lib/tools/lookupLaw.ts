import { getLaw, type LawEntry } from "./data";

export type LookupLawResult = { found: true; key: string; law: LawEntry } | { found: false };

export function lookupLaw(key: string): LookupLawResult {
  const law = getLaw(key);
  return law ? { found: true, key, law } : { found: false };
}
