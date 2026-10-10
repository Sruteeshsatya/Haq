import fs from "node:fs/promises";
import { defaultCasesRoot, listCaseFiles, readCaseFile } from "../tools/caseFiles";
import { runningCases } from "./http";
import { buildRouteView, buildSources } from "./routeView";

export type CaseStatus = "running" | "done" | "error";

async function readOptional(caseId: string, rel: string, root: string): Promise<string | null> {
  try {
    return await readCaseFile(caseId, rel, root);
  } catch {
    return null;
  }
}

async function readJson(caseId: string, rel: string, root: string): Promise<unknown> {
  const text = await readOptional(caseId, rel, root);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Parses the lines of events.jsonl, skipping any partial or corrupt line. */
export function parseEventLines(raw: string): Array<{ type?: string; message?: string; [key: string]: unknown }> {
  const events: Array<{ type?: string; message?: string; [key: string]: unknown }> = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const value: unknown = JSON.parse(trimmed);
      if (value && typeof value === "object") events.push(value as { type?: string });
    } catch {
      // ignore a partial last line
    }
  }
  return events;
}

/**
 * Status rule: running if a run is active in this process; otherwise the last event decides
 * (done -> done, error -> error). Any other last event, or no events, means the run was
 * interrupted (for example the server restarted), reported as "error" so clients stop waiting.
 */
export function deriveStatus(
  isRunning: boolean,
  events: Array<{ type?: string; message?: string }>,
): { status: CaseStatus; error: string | null } {
  if (isRunning) return { status: "running", error: null };
  const last = events[events.length - 1];
  if (last?.type === "done") return { status: "done", error: null };
  if (last?.type === "error") return { status: "error", error: last.message ?? "The run failed." };
  return { status: "error", error: "The run was interrupted before it finished." };
}

export async function getCaseView(caseId: string, root: string = defaultCasesRoot()) {
  const rawEvents = (await readOptional(caseId, "events.jsonl", root)) ?? "";
  const { status, error } = deriveStatus(runningCases().has(caseId), parseEventLines(rawEvents));

  const facts = await readOptional(caseId, "facts.md", root);
  const language = /^Language:\s*(en|hi|as)\s*$/m.exec(facts ?? "")?.[1] ?? "en";
  const summaryFile = `summary.${language}.md`;

  const files = await listCaseFiles(caseId, root);
  const evidence = files.filter((file) => file.startsWith("evidence/")).map((file) => file.slice("evidence/".length));

  const routing = await readJson(caseId, "routing.json", root);

  return {
    caseId,
    facts,
    routing,
    route: buildRouteView(routing),
    sources: buildSources(routing),
    timeline: await readJson(caseId, "timeline.json", root),
    checks: await readJson(caseId, "checks.json", root),
    drafts: {
      complaint: await readOptional(caseId, "drafts/complaint.md", root),
      rti: await readOptional(caseId, "drafts/rti.md", root),
      first_appeal: await readOptional(caseId, "drafts/first_appeal.md", root),
    },
    filingGuide: await readOptional(caseId, "filing_guide.md", root),
    summary: { language, text: await readOptional(caseId, summaryFile, root) },
    evidence,
    status,
    error,
  };
}

export async function fileSize(file: string): Promise<number> {
  try {
    return (await fs.stat(file)).size;
  } catch {
    return 0;
  }
}
