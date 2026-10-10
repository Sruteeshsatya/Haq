import fs from "node:fs";
import path from "node:path";
import { Agent } from "@cline/sdk";
import { defaultCasesRoot, safeCasePath } from "../tools/caseFiles";
import { createCaseTools, unwrapToolResult } from "./caseTools";
import { appendEventLine, type CaseEvent, type CaseEventInput, type RunMode } from "./events";
import { getModelConfig } from "./model";

type AgentConfig = ConstructorParameters<typeof Agent>[0];
type MockModel = Extract<AgentConfig, { model: unknown }>["model"];

export const DEFAULT_MAX_ITERATIONS = 30;
export const DEFAULT_TIMEOUT_MS = 4 * 60 * 1000;
export const TIMEOUT_MESSAGE = "Timed out after 4 minutes. The case was not finished.";

export interface RunCaseOptions {
  /** Folder that holds all cases. Defaults to <cwd>/cases. */
  root?: string;
  /** Path of the system prompt file. Defaults to <cwd>/prompts/caseworker.md. */
  promptPath?: string;
  /** "first_appeal": only drafts/first_appeal.md must pass before finish_case. Default "new". */
  mode?: RunMode;
  /** A pre-built model, used by tests so the real API is never called. */
  model?: MockModel;
  maxIterations?: number;
  /** Overall time limit for the run. Defaults to 4 minutes. */
  timeoutMs?: number;
}

export interface RunCaseResult {
  status: "done" | "error";
  summary?: string;
  error?: string;
}

type Part = { type: string; text?: string };

function textOf(parts: ReadonlyArray<Part>): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("")
    .trim();
}

/**
 * Runs the Cline SDK caseworker agent on cases/<caseId>/ and streams simplified events.
 * Every event is also appended to cases/<caseId>/events.jsonl. Never throws.
 */
export async function runCase(
  caseId: string,
  onEvent: (event: CaseEvent) => void = () => {},
  options: RunCaseOptions = {},
): Promise<RunCaseResult> {
  const root = options.root ?? defaultCasesRoot();

  const emit = (input: CaseEventInput): void => {
    const event = { ...input, ts: Date.now() } as CaseEvent;
    try {
      appendEventLine(caseId, event, root);
    } catch {
      // A log failure must not stop the run.
    }
    try {
      onEvent(event);
    } catch {
      // A failing listener must not stop the run.
    }
  };

  try {
    safeCasePath(caseId, "facts.md", root);
  } catch (error) {
    // Invalid id: tell the listener only; do not create a folder for it.
    const message = error instanceof Error ? error.message : String(error);
    try {
      onEvent({ type: "error", ts: Date.now(), message });
    } catch {
      // ignore
    }
    return { status: "error", error: message };
  }

  const fail = (message: string): RunCaseResult => {
    emit({ type: "error", message });
    return { status: "error", error: message };
  };

  // Every run starts with this event, so a client can tell where the latest run begins.
  const mode: RunMode = options.mode ?? "new";
  emit({ type: "start", mode });

  let systemPrompt: string;
  try {
    const promptPath = options.promptPath ?? path.join(process.cwd(), "prompts", "caseworker.md");
    systemPrompt = fs.readFileSync(promptPath, "utf8");
  } catch (error) {
    return fail(`Could not load the system prompt: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!fs.existsSync(path.join(root, caseId, "facts.md"))) {
    return fail("This case has no facts.md. Create the case first.");
  }

  const modelConfig = getModelConfig();
  if (!options.model && !modelConfig.apiKey) {
    return fail("CLINE_API_KEY is not set. Add it to .env.local.");
  }

  let finishedSummary: string | undefined;
  const tools = createCaseTools(caseId, {
    emit,
    root,
    mode,
    onFinish: (summary) => {
      finishedSummary = summary;
    },
  });

  const agentConfig = {
    ...(options.model ? { model: options.model } : modelConfig),
    systemPrompt,
    tools,
    maxIterations: options.maxIterations ?? DEFAULT_MAX_ITERATIONS,
    completionPolicy: { requireCompletionTool: true },
    hooks: {
      // The runtime nests a returned { output, isError } result; unwrap it so errors are real errors.
      afterTool: ({ result }: { result: { output: unknown; isError?: boolean } }) => {
        const unwrapped = unwrapToolResult(result);
        return unwrapped ? { result: unwrapped } : undefined;
      },
    },
  } as AgentConfig;

  const agent = new Agent(agentConfig);

  agent.subscribe((event) => {
    switch (event.type) {
      case "assistant-message": {
        const text = textOf(event.message.content as ReadonlyArray<Part>);
        if (text) emit({ type: "text", text });
        break;
      }
      case "tool-started":
        emit({
          type: "tool_call",
          toolName: event.toolCall.toolName,
          toolCallId: event.toolCall.toolCallId,
          input: event.toolCall.input,
        });
        break;
      case "tool-finished": {
        const part = event.message.content.find((item) => item.type === "tool-result");
        const isResult = part !== undefined && part.type === "tool-result";
        emit({
          type: "tool_result",
          toolName: event.toolCall.toolName,
          toolCallId: event.toolCall.toolCallId,
          output: isResult ? part.output : undefined,
          isError: isResult ? part.isError === true : false,
        });
        break;
      }
      default:
        break;
    }
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    emit({ type: "error", message: TIMEOUT_MESSAGE });
    agent.abort(new Error(TIMEOUT_MESSAGE));
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const task =
      mode === "first_appeal"
        ? `Work on case "${caseId}" in first appeal mode. Start by reading facts.md and follow the first appeal steps.`
        : `Work on case "${caseId}". Start by reading facts.md and follow your steps.`;
    const result = await agent.run(task);
    if (timedOut) return { status: "error", error: TIMEOUT_MESSAGE };
    if (finishedSummary !== undefined) {
      emit({ type: "done", summary: finishedSummary });
      return { status: "done", summary: finishedSummary };
    }
    if (result.status === "failed") return fail(result.error?.message ?? "The agent run failed.");
    if (result.status === "aborted") return fail("The agent run was stopped.");
    return fail("The agent stopped without finishing the case (finish_case was not accepted).");
  } catch (error) {
    if (timedOut) return { status: "error", error: TIMEOUT_MESSAGE };
    return fail(error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
  }
}
