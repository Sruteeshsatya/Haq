import fs from "node:fs";
import path from "node:path";
import { defaultCasesRoot } from "../tools/caseFiles";
import type { DraftCheck, DraftKind } from "../tools/checkDraft";

export type RunMode = "new" | "first_appeal";

/** Simplified events the UI consumes. They never depend on Cline SDK event names. */
export type CaseEvent =
  /** First event of every run. A new `start` marks where the latest run begins in events.jsonl. */
  | { type: "start"; ts: number; mode: RunMode }
  | { type: "text"; ts: number; text: string }
  | { type: "tool_call"; ts: number; toolName: string; toolCallId: string; input: unknown }
  | {
      type: "tool_result";
      ts: number;
      toolName: string;
      toolCallId: string;
      output: unknown;
      isError: boolean;
    }
  | { type: "file_written"; ts: number; path: string; bytes: number }
  | {
      type: "check";
      ts: number;
      kind: DraftKind;
      path: string;
      passed: boolean;
      checks: DraftCheck[];
    }
  | { type: "done"; ts: number; summary: string }
  | { type: "error"; ts: number; message: string };

export type CaseEventType = CaseEvent["type"];

/** Distributes Omit over the union so each event keeps its own fields. */
export type CaseEventInput = CaseEvent extends infer E
  ? E extends CaseEvent
    ? Omit<E, "ts">
    : never
  : never;

export type EmitEvent = (event: CaseEventInput) => void;

/** Appends one JSON line to cases/<caseId>/events.jsonl (synchronous, so order is guaranteed). */
export function appendEventLine(
  caseId: string,
  event: CaseEvent,
  root: string = defaultCasesRoot(),
): void {
  const file = path.join(root, caseId, "events.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(event)}\n`, "utf8");
}
