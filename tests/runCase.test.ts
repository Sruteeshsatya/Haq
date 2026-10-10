import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CaseEvent } from "../lib/agent/events";
import { runCase, TIMEOUT_MESSAGE, type RunCaseOptions } from "../lib/agent/runCase";

const GOOD_RTI = `To,
The Public Information Officer,
Guwahati Municipal Corporation, Panbazar, Guwahati - 781001

Application under Section 6(1) of the Right to Information Act, 2005
Application fee: Rs. 10. Period: from 1 January 2025 to date.
1. Copies of work orders for repair of the lane at Chandmari, Guwahati.
2. Budget sanctioned and spent on its maintenance.
3. Inspection reports and file notings about the potholes.

[Your name]
[Your address]`;

const GOOD_COMPLAINT = `Subject: Large pothole on Lane 3, Chandmari, Guwahati

There has been a large pothole on Lane 3, Chandmari, Guwahati for the last 3 months. Two people have fallen. See Annexure 1: photo.
I request you to kindly repair it within 21 days.

[Your name]
[Your phone]`;

type Step =
  | { text?: string; calls: Array<{ name: string; input: unknown }> }
  | { hang: true };

type Model = NonNullable<RunCaseOptions["model"]>;

/** A scripted model: each model request plays the next step. No network. */
function scripted(steps: Step[]): { model: Model; requests: () => number } {
  let turn = 0;
  const model: Model = {
    stream: async function* (request) {
      const step = steps[Math.min(turn, steps.length - 1)];
      turn += 1;
      if ("hang" in step) {
        await new Promise<void>((resolve) => {
          request.signal?.addEventListener("abort", () => resolve());
          setTimeout(resolve, 5000);
        });
        yield { type: "finish", reason: "aborted" };
        return;
      }
      if (step.text) yield { type: "text-delta", text: step.text };
      for (const [index, call] of step.calls.entries()) {
        yield {
          type: "tool-call-delta",
          toolCallId: `call-${turn}-${index}`,
          toolName: call.name,
          input: call.input,
        };
      }
      yield { type: "finish", reason: step.calls.length > 0 ? "tool-calls" : "stop" };
    },
  };
  return { model, requests: () => turn };
}

let root: string;
let events: CaseEvent[];

function readLog(): CaseEvent[] {
  const file = path.join(root, "c1", "events.jsonl");
  return fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as CaseEvent);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "haq-run-"));
  events = [];
  fs.mkdirSync(path.join(root, "c1", "evidence"), { recursive: true });
  fs.writeFileSync(path.join(root, "c1", "facts.md"), "Place: Guwahati\nDate: 2026-10-10\nLanguage: en\n");
  fs.writeFileSync(path.join(root, "c1", "evidence", "photo-1.jpg"), new Uint8Array([1, 2, 3]));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const collect = (event: CaseEvent) => events.push(event);
const types = () => events.map((e) => e.type);

const HAPPY_PATH: Step[] = [
  { text: "I will start.", calls: [{ name: "read_case_file", input: { path: "facts.md" } }] },
  { calls: [{ name: "find_authority", input: { issue_type: "road_pothole", place: "Guwahati" } }] },
  { calls: [{ name: "write_case_file", input: { path: "drafts/complaint.md", content: GOOD_COMPLAINT } }] },
  { calls: [{ name: "write_case_file", input: { path: "drafts/rti.md", content: GOOD_RTI } }] },
  { calls: [{ name: "check_draft", input: { kind: "complaint", path: "drafts/complaint.md" } }] },
  { calls: [{ name: "check_draft", input: { kind: "rti", path: "drafts/rti.md" } }] },
  {
    calls: [
      {
        name: "calc_deadlines",
        input: { grievanceKey: "gmc_grievance", rtiKey: "rti_assam", filingDate: "2026-10-10" },
      },
    ],
  },
  { text: "All set.", calls: [{ name: "finish_case", input: { summary: "Drafts are ready." } }] },
];

describe("runCase with a mocked model", () => {
  it("runs the flow, streams simplified events and ends with done", async () => {
    const { model } = scripted(HAPPY_PATH);
    const result = await runCase("c1", collect, { root, model });

    expect(result).toEqual({ status: "done", summary: "Drafts are ready." });
    expect(events[events.length - 1]).toMatchObject({ type: "done", summary: "Drafts are ready." });
    expect(types().filter((t) => t === "done")).toHaveLength(1);
    expect(types()).toEqual(expect.arrayContaining(["text", "tool_call", "tool_result", "file_written", "check"]));
    expect(events.every((e) => typeof e.ts === "number")).toBe(true);

    const text = events.filter((e) => e.type === "text").map((e) => (e as { text: string }).text);
    expect(text).toEqual(["I will start.", "All set."]);
    const calls = events.filter((e) => e.type === "tool_call").map((e) => (e as { toolName: string }).toolName);
    expect(calls).toEqual([
      "read_case_file", "find_authority", "write_case_file", "write_case_file",
      "check_draft", "check_draft", "calc_deadlines", "finish_case",
    ]);
    const written = events.filter((e) => e.type === "file_written").map((e) => (e as { path: string }).path);
    expect(written).toEqual(expect.arrayContaining(["routing.json", "drafts/complaint.md", "drafts/rti.md", "checks.json", "timeline.json"]));
    const checks = events.filter((e) => e.type === "check");
    expect(checks).toHaveLength(2);
    expect(checks.every((c) => (c as { passed: boolean }).passed)).toBe(true);
    expect(fs.existsSync(path.join(root, "c1", "timeline.json"))).toBe(true);
  });

  it("appends every event as one JSON line to events.jsonl, in the same order", async () => {
    const { model } = scripted(HAPPY_PATH);
    await runCase("c1", collect, { root, model });
    expect(readLog()).toEqual(events);
    expect(readLog()[0]).toMatchObject({ type: "text", text: "I will start." });
    expect(readLog()[1]).toMatchObject({ type: "tool_call", toolName: "read_case_file" });
  });

  it("refuses finish_case while drafts are missing, marks it an error, and does not end the run", async () => {
    const { model, requests } = scripted([
      { calls: [{ name: "finish_case", input: { summary: "too early" } }] },
      ...HAPPY_PATH,
    ]);
    const result = await runCase("c1", collect, { root, model });
    expect(result.status).toBe("done");
    const finishResults = events.filter((e) => e.type === "tool_result" && (e as { toolName: string }).toolName === "finish_case");
    expect(finishResults).toHaveLength(2);
    expect(finishResults[0]).toMatchObject({ isError: true });
    expect((finishResults[0] as { output: { error: string } }).output.error).toMatch(/Cannot finish yet/);
    expect(finishResults[1]).toMatchObject({ isError: false });
    expect(requests()).toBe(HAPPY_PATH.length + 1);
    expect(types().filter((t) => t === "done")).toHaveLength(1);
  });

  it("reports tool errors as isError tool_results and keeps going", async () => {
    const { model } = scripted([
      { calls: [{ name: "read_case_file", input: { path: "../secret.md" } }] },
      ...HAPPY_PATH,
    ]);
    await runCase("c1", collect, { root, model });
    const first = events.find((e) => e.type === "tool_result");
    expect(first).toMatchObject({ toolName: "read_case_file", isError: true });
    expect(types()[types().length - 1]).toBe("done");
  });

  it("emits error (and no done) when the model stops without finishing", async () => {
    const { model } = scripted([{ text: "I am done.", calls: [] }]);
    const result = await runCase("c1", collect, { root, model });
    expect(result.status).toBe("error");
    expect(types()).not.toContain("done");
    expect(events[events.length - 1]).toMatchObject({ type: "error" });
  });

  it("emits an error event on the 4-minute timeout path (shortened here) and aborts the run", async () => {
    const { model } = scripted([{ hang: true }]);
    const result = await runCase("c1", collect, { root, model, timeoutMs: 50 });
    expect(result).toEqual({ status: "error", error: TIMEOUT_MESSAGE });
    expect(events.filter((e) => e.type === "error")).toEqual([
      expect.objectContaining({ type: "error", message: TIMEOUT_MESSAGE }),
    ]);
    expect(types()).not.toContain("done");
  });

  it("stops at maxIterations with an error event", async () => {
    const { model } = scripted([{ calls: [{ name: "read_case_file", input: { path: "facts.md" } }] }]);
    const result = await runCase("c1", collect, { root, model, maxIterations: 3 });
    expect(result.status).toBe("error");
    expect(result.error).toMatch(/maxIterations/);
    expect(events[events.length - 1]).toMatchObject({ type: "error" });
  });

  it("emits an error (no API call) when CLINE_API_KEY is missing and no model is injected", async () => {
    const saved = process.env.CLINE_API_KEY;
    delete process.env.CLINE_API_KEY;
    try {
      const result = await runCase("c1", collect, { root });
      expect(result.status).toBe("error");
      expect(result.error).toMatch(/CLINE_API_KEY/);
      expect(events).toHaveLength(1);
    } finally {
      if (saved !== undefined) process.env.CLINE_API_KEY = saved;
    }
  });

  it("emits an error for a case without facts.md and for an invalid case id", async () => {
    const missing = await runCase("nofacts", collect, { root, model: scripted(HAPPY_PATH).model });
    expect(missing.status).toBe("error");
    const invalid = await runCase("../evil", collect, { root, model: scripted(HAPPY_PATH).model });
    expect(invalid.status).toBe("error");
    expect(invalid.error).toMatch(/Invalid caseId/);
    expect(fs.existsSync(path.join(root, "..", "evil"))).toBe(false);
  });

  it("a throwing onEvent listener does not break the run or the log", async () => {
    const { model } = scripted(HAPPY_PATH);
    const result = await runCase("c1", () => { throw new Error("listener bug"); }, { root, model });
    expect(result.status).toBe("done");
    expect(readLog()[readLog().length - 1]).toMatchObject({ type: "done" });
  });

  it("loads the system prompt from prompts/caseworker.md at runtime", async () => {
    let seen = "";
    const model: Model = {
      stream: async function* (request) {
        seen = request.systemPrompt ?? "";
        yield { type: "finish", reason: "stop" };
      },
    };
    const promptPath = path.join(root, "prompt.md");
    fs.writeFileSync(promptPath, "CUSTOM PROMPT");
    await runCase("c1", collect, { root, model, promptPath });
    expect(seen).toBe("CUSTOM PROMPT");
    const real = fs.readFileSync(path.join(process.cwd(), "prompts", "caseworker.md"), "utf8");
    for (const name of ["read_case_file", "write_case_file", "find_authority", "lookup_law", "calc_deadlines", "check_draft", "finish_case"]) {
      expect(real).toContain(name);
    }
  });
});
