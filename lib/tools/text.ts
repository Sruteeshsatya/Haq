function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Case-insensitive term match.
 * - Latin terms match whole words (an optional plural "s"/"es" is allowed), so
 *   "meter" does not match "kilometer" and "ration" does not match "rational".
 * - Terms with non-Latin characters (Hindi, Assamese) use plain substring matching,
 *   because word boundaries are unreliable for those scripts.
 */
export function containsTerm(text: string, term: string): boolean {
  const haystack = text.toLowerCase();
  const needle = term.toLowerCase().trim();
  if (!needle) return false;
  if (/^[a-z0-9 ]+$/.test(needle)) {
    const pattern = new RegExp(`(?<![a-z0-9])${escapeRegExp(needle)}(?:e?s)?(?![a-z0-9])`);
    return pattern.test(haystack);
  }
  return haystack.includes(needle);
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
