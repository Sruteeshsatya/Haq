import fs from "node:fs/promises";
import { isValidCaseId, safeCasePath } from "../tools/caseFiles";

/** Clean JSON error: { error }. Details of unexpected failures stay in the server log. */
export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function serverError(error: unknown): Response {
  console.error("[haq] unexpected error:", error);
  return jsonError(500, "Something went wrong on the server. Please try again.");
}

export function jsonOk(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Validates the [id] route param. Returns the id, or a 400 Response. */
export function parseCaseId(id: string): string | Response {
  return isValidCaseId(id) ? id : jsonError(400, "Invalid case id.");
}

export async function caseExists(caseId: string, root?: string): Promise<boolean> {
  try {
    const stat = await fs.stat(safeCasePath(caseId, "facts.md", root));
    return stat.isFile();
  } catch {
    return false;
  }
}

/** Today's date in India (YYYY-MM-DD). toISOString() would give the UTC date, a day early before 05:30 IST. */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

type RunRegistry = Set<string>;
const REGISTRY_KEY = Symbol.for("haq.runningCases");

/** Case ids with a run in progress. Lives on globalThis so it survives dev hot reloads. */
export function runningCases(): RunRegistry {
  const holder = globalThis as unknown as Record<symbol, RunRegistry | undefined>;
  holder[REGISTRY_KEY] ??= new Set<string>();
  return holder[REGISTRY_KEY];
}

/** Claims the case for a run. Synchronous, so two requests cannot both win. False when already running. */
export function claimRun(caseId: string): boolean {
  const set = runningCases();
  if (set.has(caseId)) return false;
  set.add(caseId);
  return true;
}

export function releaseRun(caseId: string): void {
  runningCases().delete(caseId);
}
