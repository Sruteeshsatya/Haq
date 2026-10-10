import { createTool, type AgentTool } from "@cline/sdk";
import { z } from "zod";
import { calcDeadlines } from "../tools/calcDeadlines";
import {
  defaultCasesRoot,
  listCaseFiles,
  readCaseFile,
  safeCasePath,
  writeCaseFile,
} from "../tools/caseFiles";
import { checkDraft, type CheckDraftResult, type DraftKind } from "../tools/checkDraft";
import { ISSUE_TYPES, LAW_KEYS } from "../tools/data";
import { findAuthority } from "../tools/findAuthority";
import { lookupLaw } from "../tools/lookupLaw";
import type { EmitEvent } from "./events";

/** A caseworker tool. Input is `unknown` because every tool re-validates it with zod. */
export type CaseTool = AgentTool<unknown, unknown>;

export const MAX_CONTENT_CHARS = 50_000;

export const REQUIRED_DRAFTS: ReadonlyArray<{ kind: DraftKind; path: string }> = [
  { kind: "complaint", path: "drafts/complaint.md" },
  { kind: "rti", path: "drafts/rti.md" },
];
export const FIRST_APPEAL_DRAFT = { kind: "first_appeal" as DraftKind, path: "drafts/first_appeal.md" };

/** Files written only by Haq's own tools. The model may not write them. */
const TOOL_OWNED_FILES = new Set(["events.jsonl", "routing.json", "timeline.json", "checks.json"]);

export interface CaseToolsOptions {
  emit: EmitEvent;
  /** Folder that holds all cases. Defaults to <cwd>/cases; tests pass a temp folder. */
  root?: string;
  /** Called once when finish_case succeeds. */
  onFinish?: (summary: string) => void;
}

export interface ToolFailure {
  output: { error: string; [key: string]: unknown };
  isError: true;
}

/** Error shape for tools: returned, never thrown. */
export function fail(message: string, extra: Record<string, unknown> = {}): ToolFailure {
  return { output: { error: message, ...extra }, isError: true };
}

/**
 * The Cline runtime wraps whatever execute() returns as `output`, so a returned
 * { output, isError: true } would arrive nested and look like a success. This
 * unwraps it; use it in hooks.afterTool. Returns undefined when nothing to change.
 */
export function unwrapToolResult(result: {
  output: unknown;
  isError?: boolean;
}): { output: unknown; isError: true } | undefined {
  const value = result.output;
  if (
    result.isError !== true &&
    value !== null &&
    typeof value === "object" &&
    (value as { isError?: unknown }).isError === true &&
    "output" in value
  ) {
    return { output: (value as { output: unknown }).output, isError: true };
  }
  return undefined;
}

function normalizeKey(relPath: string): string {
  return relPath
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.replace(/[. ]+$/, ""))
    .filter((segment) => segment !== "")
    .join("/")
    .toLowerCase();
}

function isEvidenceOrLog(key: string): boolean {
  return key === "events.jsonl" || key === "evidence" || key.startsWith("evidence/");
}

const filePath = z.string().min(1).describe("Path relative to the case folder, e.g. drafts/rti.md");
const draftKind = z.enum(["complaint", "rti", "first_appeal"]).describe("Which kind of draft");

const readSchema = z.object({ path: filePath });
const writeSchema = z.object({
  path: filePath,
  content: z.string().describe(`Full file content (max ${MAX_CONTENT_CHARS} characters)`),
});
const findSchema = z.object({
  issue_type: z.enum(ISSUE_TYPES).describe("The kind of problem"),
  place: z.string().optional().describe("City or place from facts.md, if known"),
});
const lookupSchema = z.object({ key: z.enum(LAW_KEYS).describe("Key of a law or portal") });
const deadlinesSchema = z.object({
  grievanceKey: z.string().describe("grievanceKey from find_authority"),
  rtiKey: z.string().describe("rtiKey from find_authority"),
  filingDate: z.string().describe("RTI filing date, YYYY-MM-DD (the Date line in facts.md)"),
  firstAppealDate: z
    .string()
    .optional()
    .describe("YYYY-MM-DD, only if the first appeal was really filed on that date"),
});
const checkSchema = z.object({ kind: draftKind, path: filePath });
const finishSchema = z.object({
  summary: z.string().min(1).describe("One or two sentences on what was prepared"),
});

/** Validates input at runtime (the SDK does not enforce enums) and never lets an error escape. */
function guarded<S extends z.ZodTypeAny>(schema: S, run: (input: z.infer<S>) => Promise<unknown>) {
  return async (input: unknown): Promise<unknown> => {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`)
        .join("; ");
      return fail(`Invalid input: ${issues}`);
    }
    try {
      return await run(parsed.data);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  };
}

/** Builds the seven caseworker tools for ONE case. File access is scoped to cases/<caseId>/. */
export function createCaseTools(caseId: string, options: CaseToolsOptions): CaseTool[] {
  const root = options.root ?? defaultCasesRoot();
  const { emit } = options;

  async function save(relPath: string, content: string): Promise<void> {
    await writeCaseFile(caseId, relPath, content, root);
    emit({ type: "file_written", path: relPath.replace(/\\/g, "/"), bytes: Buffer.byteLength(content) });
  }

  async function hasEvidence(): Promise<boolean> {
    const files = await listCaseFiles(caseId, root);
    return files.some((file) => file.startsWith("evidence/"));
  }

  async function readDraft(relPath: string): Promise<string | undefined> {
    try {
      return await readCaseFile(caseId, relPath, root);
    } catch {
      return undefined;
    }
  }

  async function saveCheckResult(
    relPath: string,
    kind: DraftKind,
    result: CheckDraftResult,
  ): Promise<void> {
    let all: Record<string, unknown> = {};
    try {
      all = JSON.parse(await readCaseFile(caseId, "checks.json", root)) as Record<string, unknown>;
    } catch {
      all = {};
    }
    all[relPath] = { kind, passed: result.passed, checks: result.checks };
    await save("checks.json", JSON.stringify(all, null, 2));
  }

  const readTool = createTool({
    name: "read_case_file",
    description: "Read a text file inside this case folder, e.g. facts.md. Evidence files cannot be read.",
    inputSchema: readSchema,
    execute: guarded(readSchema, async ({ path: rel }) => {
      const key = normalizeKey(rel);
      if (isEvidenceOrLog(key)) return fail("This file cannot be read.");
      safeCasePath(caseId, rel, root);
      return { path: rel, content: await readCaseFile(caseId, rel, root) };
    }),
  });

  const writeTool = createTool({
    name: "write_case_file",
    description:
      "Write a text file inside this case folder (creates folders). Use it for plan.md, drafts/*.md, filing_guide.md and summary.<lang>.md. " +
      "routing.json, timeline.json and checks.json are written by other tools.",
    inputSchema: writeSchema,
    execute: guarded(writeSchema, async ({ path: rel, content }) => {
      const key = normalizeKey(rel);
      if (isEvidenceOrLog(key)) return fail("This file cannot be written.");
      if (TOOL_OWNED_FILES.has(key)) return fail(`${key} is written by a tool; do not write it yourself.`);
      if (content.length > MAX_CONTENT_CHARS) {
        return fail(`Content is too long (${content.length} characters; max ${MAX_CONTENT_CHARS}).`);
      }
      safeCasePath(caseId, rel, root);
      await save(rel, content);
      return { written: rel.replace(/\\/g, "/"), bytes: Buffer.byteLength(content) };
    }),
  });

  const findTool = createTool({
    name: "find_authority",
    description:
      "Find the responsible office for the issue (city, then state, then central). Returns level, office, grievanceKey, rtiKey, rtiPio, verified and sources. Saves routing.json automatically.",
    inputSchema: findSchema,
    execute: guarded(findSchema, async ({ issue_type, place }) => {
      const result = findAuthority(issue_type, place);
      await save("routing.json", JSON.stringify({ issueType: issue_type, place: place ?? "", result }, null, 2));
      return result;
    }),
  });

  const lawTool = createTool({
    name: "lookup_law",
    description: "Look up rules, fees, portals, deadlines and sources for a law or grievance channel key.",
    inputSchema: lookupSchema,
    execute: guarded(lookupSchema, async ({ key }) => lookupLaw(key)),
  });

  const deadlinesTool = createTool({
    name: "calc_deadlines",
    description:
      "Compute the deadline timeline from the RTI filing date (day 0). Never compute dates yourself. Saves timeline.json automatically.",
    inputSchema: deadlinesSchema,
    execute: guarded(deadlinesSchema, async (input) => {
      const events = calcDeadlines(
        { grievanceKey: input.grievanceKey, rtiKey: input.rtiKey },
        input.filingDate,
        { firstAppealDate: input.firstAppealDate },
      );
      const timeline = { filingDate: input.filingDate, firstAppealDate: input.firstAppealDate ?? null, events };
      await save("timeline.json", JSON.stringify(timeline, null, 2));
      return timeline;
    }),
  });

  const checkTool = createTool({
    name: "check_draft",
    description:
      "Run deterministic checks on a draft file. Returns pass/fail and a hint for every check. Fix the draft and run it again until everything passes.",
    inputSchema: checkSchema,
    execute: guarded(checkSchema, async ({ kind, path: rel }) => {
      const key = normalizeKey(rel);
      if (isEvidenceOrLog(key)) return fail("This file cannot be checked.");
      const text = await readCaseFile(caseId, rel, root);
      const result = checkDraft(kind, text, { hasEvidence: await hasEvidence() });
      const shown = rel.replace(/\\/g, "/");
      emit({ type: "check", kind, path: shown, passed: result.passed, checks: result.checks });
      await saveCheckResult(shown, kind, result);
      return result;
    }),
  });

  const finishTool = createTool({
    name: "finish_case",
    description:
      "Call once at the very end. Refuses to finish unless drafts/complaint.md and drafts/rti.md exist and pass all checks.",
    inputSchema: finishSchema,
    lifecycle: { completesRun: true },
    execute: guarded(finishSchema, async ({ summary }) => {
      const drafts = [...REQUIRED_DRAFTS];
      if ((await readDraft(FIRST_APPEAL_DRAFT.path)) !== undefined) drafts.push(FIRST_APPEAL_DRAFT);
      const evidence = await hasEvidence();
      const problems: string[] = [];
      for (const draft of drafts) {
        const text = await readDraft(draft.path);
        if (text === undefined) {
          problems.push(`${draft.path} is missing.`);
          continue;
        }
        const failing = checkDraft(draft.kind, text, { hasEvidence: evidence }).checks.filter(
          (check) => !check.passed,
        );
        if (failing.length > 0) {
          const detail = failing.map((check) => `${check.label} (${check.hint})`).join("; ");
          problems.push(`${draft.path} fails: ${detail}`);
        }
      }
      if (problems.length > 0) return fail("Cannot finish yet. Fix these first.", { problems });
      options.onFinish?.(summary);
      return { finished: true, summary };
    }),
  });

  // Each tool validates its own input with zod (see guarded), so the input type is widened here.
  return [readTool, writeTool, findTool, lawTool, deadlinesTool, checkTool, finishTool] as CaseTool[];
}
