import type { CaseData } from "./types";

export type CaseFetch = { kind: "ok"; data: CaseData } | { kind: "missing" } | { kind: "error" };

/** GET /api/cases/[id]. Never throws: network and server problems come back as { kind: "error" }. */
export async function fetchCase(caseId: string): Promise<CaseFetch> {
  try {
    const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}`, { cache: "no-store" });
    if (response.status === 404 || response.status === 400) return { kind: "missing" };
    if (!response.ok) return { kind: "error" };
    return { kind: "ok", data: (await response.json()) as CaseData };
  } catch {
    return { kind: "error" };
  }
}
