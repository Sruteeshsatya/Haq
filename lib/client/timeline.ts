import type { CaseEvent } from "../agent/events";

/** One line in the "Haq is working" panel. */
export type TimelineItem =
  | { kind: "step"; id: string; label: string; status: "running" | "ok" | "failed"; detail?: string }
  | { kind: "file"; id: string; path: string }
  | { kind: "note"; id: string; text: string }
  | {
      kind: "check";
      id: string;
      path: string;
      draft: string;
      passed: boolean;
      /** Set when this draft failed earlier and passes now: the demo moment. */
      fixed: boolean;
      checks: Array<{ id: string; label: string; passed: boolean; hint: string }>;
    }
  | { kind: "error"; id: string; message: string }
  | { kind: "done"; id: string; summary: string };

export interface TimelineSection {
  id: string;
  mode: "new" | "first_appeal";
  items: TimelineItem[];
  finished: "running" | "done" | "error";
}

export type StreamEvent = CaseEvent & { eventId: number };

const DRAFT_NAMES: Record<string, string> = {
  "drafts/complaint.md": "your complaint",
  "drafts/rti.md": "your RTI application",
  "drafts/first_appeal.md": "your first appeal",
};

/** Human name for a draft path, falling back to the file name. */
export function draftName(path: string): string {
  return DRAFT_NAMES[path] ?? path.split("/").pop() ?? path;
}

function fileLabel(path: string): string {
  if (path in DRAFT_NAMES) return DRAFT_NAMES[path];
  if (path === "plan.md") return "the plan";
  if (path === "filing_guide.md") return "the filing guide";
  if (/^summary\./.test(path)) return "your summary";
  return path;
}

/** Friendly sentence for a tool call. Never shows raw tool names to the citizen. */
export function toolLabel(toolName: string, input: unknown): string {
  const args = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  switch (toolName) {
    case "read_case_file":
      return "Reading your details";
    case "find_authority":
      return "Finding the responsible office";
    case "lookup_law":
      return "Checking the law and portal";
    case "calc_deadlines":
      return "Calculating your deadlines";
    case "write_case_file":
      return `Writing ${typeof args.path === "string" ? fileLabel(args.path) : "a file"}`;
    case "check_draft":
      return `Checking ${typeof args.path === "string" ? draftName(args.path) : "the draft"}`;
    case "finish_case":
      return "Finishing up";
    default:
      return "Working";
  }
}

function errorText(output: unknown): string {
  if (output && typeof output === "object") {
    const error = (output as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return "That step did not work, so Haq will try another way.";
}

/**
 * Turns the event stream into sections for the live panel. A "start" event opens a new section
 * (a new run, for example the first appeal). Pure and deterministic: the UI calls it on every
 * new event, and the unit tests call it with sample streams.
 */
export function reduceEvents(events: StreamEvent[]): TimelineSection[] {
  const sections: TimelineSection[] = [];
  const failedBefore = new Set<string>();
  const stepIndex = new Map<string, TimelineItem>();

  const current = (event: StreamEvent): TimelineSection => {
    let section = sections[sections.length - 1];
    if (!section) {
      section = { id: `s${event.eventId}`, mode: "new", items: [], finished: "running" };
      sections.push(section);
    }
    return section;
  };

  for (const event of events) {
    if (event.type === "start") {
      sections.push({ id: `s${event.eventId}`, mode: event.mode, items: [], finished: "running" });
      continue;
    }
    const section = current(event);
    const id = `e${event.eventId}`;
    switch (event.type) {
      case "text":
        section.items.push({ kind: "note", id, text: event.text });
        break;
      case "tool_call": {
        const item: TimelineItem = { kind: "step", id, label: toolLabel(event.toolName, event.input), status: "running" };
        stepIndex.set(event.toolCallId, item);
        section.items.push(item);
        break;
      }
      case "tool_result": {
        const item = stepIndex.get(event.toolCallId);
        if (item && item.kind === "step") {
          item.status = event.isError ? "failed" : "ok";
          if (event.isError) item.detail = errorText(event.output);
        }
        break;
      }
      case "file_written":
        // tool-owned bookkeeping files are noise for a citizen
        if (!["checks.json", "routing.json", "timeline.json"].includes(event.path)) {
          section.items.push({ kind: "file", id, path: event.path });
        }
        break;
      case "check": {
        const fixed = event.passed && failedBefore.has(event.path);
        if (!event.passed) failedBefore.add(event.path);
        section.items.push({
          kind: "check",
          id,
          path: event.path,
          draft: draftName(event.path),
          passed: event.passed,
          fixed,
          checks: event.checks,
        });
        break;
      }
      case "done":
        section.items.push({ kind: "done", id, summary: event.summary });
        section.finished = "done";
        break;
      case "error":
        section.items.push({ kind: "error", id, message: event.message });
        section.finished = "error";
        break;
    }
  }
  return sections;
}

/** True if any section is still running (no done or error yet). */
export function isRunning(sections: TimelineSection[]): boolean {
  const last = sections[sections.length - 1];
  return !last || last.finished === "running";
}
