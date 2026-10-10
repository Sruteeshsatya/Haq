import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCaseTools, MAX_CONTENT_CHARS, unwrapToolResult } from "../lib/agent/caseTools";
import type { CaseEventInput } from "../lib/agent/events";

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

To the Public Grievance Officer,
There has been a large pothole on Lane 3, Chandmari, Guwahati for the last 3 months. Two people have fallen. See Annexure 1: photo.
I request you to kindly repair it within 21 days.

[Your name]
[Your phone]`;

const ctx = { agentId: "test", iteration: 1 };

let root: string;
let events: CaseEventInput[];
let tools: ReturnType<typeof createCaseTools>;

/** Calls a tool's execute() directly. Results are loosely typed so tests can inspect any field. */
async function exec(
  list: ReturnType<typeof createCaseTools>,
  name: string,
  input: unknown,
): Promise<Record<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const found = list.find((t) => t.name === name);
  if (!found) throw new Error(`no tool ${name}`);
  return (await found.execute(input, ctx)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const run = (name: string, input: unknown) => exec(tools, name, input);

function put(rel: string, content: string | Uint8Array): void {
  const file = path.join(root, "c1", rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "haq-tools-"));
  events = [];
  put("facts.md", "Place: Guwahati\nDate: 2026-10-10\n");
  tools = createCaseTools("c1", { emit: (event) => events.push(event), root });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("tool set", () => {
  it("has the seven tools and only finish_case completes the run", () => {
    expect(tools.map((t) => t.name).sort()).toEqual([
      "calc_deadlines",
      "check_draft",
      "find_authority",
      "finish_case",
      "lookup_law",
      "read_case_file",
      "write_case_file",
    ]);
    expect(tools.filter((t) => t.lifecycle?.completesRun).map((t) => t.name)).toEqual(["finish_case"]);
  });
});

describe("read_case_file / write_case_file scoping", () => {
  it("writes and reads inside the case folder and emits file_written", async () => {
    const written = await run("write_case_file", { path: "plan.md", content: "- step" });
    expect(written).toEqual({ written: "plan.md", bytes: 6 });
    expect(fs.readFileSync(path.join(root, "c1", "plan.md"), "utf8")).toBe("- step");
    expect(events).toEqual([{ type: "file_written", path: "plan.md", bytes: 6 }]);
    expect((await run("read_case_file", { path: "plan.md" })).content).toBe("- step");
  });

  it("creates nested folders", async () => {
    await run("write_case_file", { path: "drafts/rti.md", content: "x" });
    expect(fs.existsSync(path.join(root, "c1", "drafts", "rti.md"))).toBe(true);
  });

  it("rejects '..', absolute paths and backslash tricks with the error shape, without writing", async () => {
    for (const bad of ["../evil.md", "a/../../evil.md", "/etc/x", "C:\\x.md", "..\\evil.md"]) {
      const write = await run("write_case_file", { path: bad, content: "x" });
      expect(write.isError, bad).toBe(true);
      expect(typeof write.output.error).toBe("string");
      const read = await run("read_case_file", { path: bad });
      expect(read.isError, bad).toBe(true);
    }
    expect(fs.existsSync(path.join(root, "evil.md"))).toBe(false);
    expect(events).toEqual([]);
  });

  it("returns an error (does not throw) for a missing file", async () => {
    const result = await run("read_case_file", { path: "nope.md" });
    expect(result.isError).toBe(true);
    expect(result.output.error).toMatch(/ENOENT|no such file/i);
  });

  it("blocks evidence/** and events.jsonl, in any spelling", async () => {
    put("evidence/photo-1.jpg", new Uint8Array([1, 2]));
    put("events.jsonl", "{}\n");
    const spellings = ["evidence/photo-1.jpg", "Evidence/photo-1.jpg", "./evidence/new.jpg", "events.jsonl", "EVENTS.JSONL", "evidence\\x.jpg"];
    for (const rel of spellings) {
      expect((await run("read_case_file", { path: rel })).isError, rel).toBe(true);
      expect((await run("write_case_file", { path: rel, content: "x" })).isError, rel).toBe(true);
    }
    expect(fs.readFileSync(path.join(root, "c1", "events.jsonl"), "utf8")).toBe("{}\n");
    expect(fs.readFileSync(path.join(root, "c1", "evidence", "photo-1.jpg")).length).toBe(2);
  });

  it("does not let the model write files owned by other tools", async () => {
    for (const rel of ["routing.json", "timeline.json", "checks.json", "./Routing.json"]) {
      const result = await run("write_case_file", { path: rel, content: "{}" });
      expect(result.isError, rel).toBe(true);
      expect(result.output.error).toMatch(/written by a tool/);
    }
  });

  it("caps content at 50k characters", async () => {
    expect(MAX_CONTENT_CHARS).toBe(50_000);
    const result = await run("write_case_file", { path: "big.md", content: "a".repeat(MAX_CONTENT_CHARS + 1) });
    expect(result.isError).toBe(true);
    expect(fs.existsSync(path.join(root, "c1", "big.md"))).toBe(false);
    const ok = await run("write_case_file", { path: "ok.md", content: "a".repeat(MAX_CONTENT_CHARS) });
    expect(ok.isError).toBeUndefined();
  });

  it("rejects bad input shapes with the error shape instead of throwing", async () => {
    for (const input of [undefined, null, {}, { path: 5 }, { path: "" }, { path: "a.md" }]) {
      const result = await run("write_case_file", input);
      expect(result.isError).toBe(true);
      expect(result.output.error).toMatch(/Invalid input/);
    }
  });

  it("is scoped to its own case", async () => {
    const other = createCaseTools("c2", { emit: () => {}, root });
    await exec(other, "write_case_file", { path: "a.md", content: "two" });
    expect(fs.existsSync(path.join(root, "c2", "a.md"))).toBe(true);
    expect(fs.existsSync(path.join(root, "c1", "a.md"))).toBe(false);
  });
});

describe("find_authority / lookup_law / calc_deadlines", () => {
  it("find_authority routes, saves routing.json and emits file_written", async () => {
    const result = await run("find_authority", { issue_type: "road_pothole", place: "Guwahati" });
    expect(result.covered).toBe(true);
    expect(result.level).toBe("city");
    const saved = JSON.parse(fs.readFileSync(path.join(root, "c1", "routing.json"), "utf8"));
    expect(saved.result.grievanceKey).toBe("gmc_grievance");
    expect(events.map((e) => e.type)).toEqual(["file_written"]);
  });

  it("rejects an issue_type outside the enum (the SDK does not enforce enums)", async () => {
    const result = await run("find_authority", { issue_type: "made_up", place: "Guwahati" });
    expect(result.isError).toBe(true);
    expect(result.output.error).toMatch(/Invalid input/);
    expect(fs.existsSync(path.join(root, "c1", "routing.json"))).toBe(false);
  });

  it("lookup_law returns a law and rejects an unknown key", async () => {
    expect((await run("lookup_law", { key: "cpgrams" })).found).toBe(true);
    expect((await run("lookup_law", { key: "nope" })).isError).toBe(true);
  });

  it("calc_deadlines computes, saves timeline.json, and supports firstAppealDate", async () => {
    const base = { grievanceKey: "gmc_grievance", rtiKey: "rti_assam", filingDate: "2026-01-05" };
    const result = await run("calc_deadlines", base);
    expect(result.events.find((e: { label: string }) => e.label === "RTI reply due").date).toBe("2026-02-04");
    const saved = JSON.parse(fs.readFileSync(path.join(root, "c1", "timeline.json"), "utf8"));
    expect(saved.filingDate).toBe("2026-01-05");
    const later = await run("calc_deadlines", { ...base, firstAppealDate: "2026-02-10" });
    const faa = later.events.find((e: { label: string }) => e.label === "First appeal decision due");
    expect(faa.date).toBe("2026-03-12");
  });

  it("calc_deadlines returns an error for a bad date instead of throwing", async () => {
    const result = await run("calc_deadlines", { grievanceKey: "gmc_grievance", rtiKey: "rti_assam", filingDate: "tomorrow" });
    expect(result.isError).toBe(true);
    expect(result.output.error).toMatch(/YYYY-MM-DD/);
    expect(fs.existsSync(path.join(root, "c1", "timeline.json"))).toBe(false);
  });
});

describe("check_draft", () => {
  it("checks a draft, emits check, and records checks.json", async () => {
    put("drafts/rti.md", GOOD_RTI);
    const result = await run("check_draft", { kind: "rti", path: "drafts/rti.md" });
    expect(result.passed).toBe(true);
    const checkEvent = events.find((e) => e.type === "check");
    expect(checkEvent).toMatchObject({ type: "check", kind: "rti", path: "drafts/rti.md", passed: true });
    const saved = JSON.parse(fs.readFileSync(path.join(root, "c1", "checks.json"), "utf8"));
    expect(saved["drafts/rti.md"].passed).toBe(true);
  });

  it("keeps the latest result per draft", async () => {
    put("drafts/rti.md", "Dear sir");
    await run("check_draft", { kind: "rti", path: "drafts/rti.md" });
    put("drafts/complaint.md", GOOD_COMPLAINT);
    await run("check_draft", { kind: "complaint", path: "drafts/complaint.md" });
    put("drafts/rti.md", GOOD_RTI);
    await run("check_draft", { kind: "rti", path: "drafts/rti.md" });
    const saved = JSON.parse(fs.readFileSync(path.join(root, "c1", "checks.json"), "utf8"));
    expect(saved["drafts/rti.md"].passed).toBe(true);
    expect(Object.keys(saved).sort()).toEqual(["drafts/complaint.md", "drafts/rti.md"]);
  });

  it("passes hasEvidence only when evidence/ has files", async () => {
    put("drafts/complaint.md", GOOD_COMPLAINT.replace("See Annexure 1: photo.", ""));
    expect((await run("check_draft", { kind: "complaint", path: "drafts/complaint.md" })).passed).toBe(true);
    put("evidence/photo-1.jpg", new Uint8Array([1]));
    const withEvidence = await run("check_draft", { kind: "complaint", path: "drafts/complaint.md" });
    expect(withEvidence.passed).toBe(false);
    expect(withEvidence.checks.find((c: { id: string }) => c.id === "complaint_annexure").passed).toBe(false);
  });

  it("returns errors for a missing file, a blocked path, a bad kind and a path escape", async () => {
    expect((await run("check_draft", { kind: "rti", path: "drafts/none.md" })).isError).toBe(true);
    expect((await run("check_draft", { kind: "rti", path: "events.jsonl" })).isError).toBe(true);
    expect((await run("check_draft", { kind: "letter", path: "drafts/rti.md" })).isError).toBe(true);
    expect((await run("check_draft", { kind: "rti", path: "../x.md" })).isError).toBe(true);
  });
});

describe("finish_case", () => {
  it("refuses when drafts are missing", async () => {
    const result = await run("finish_case", { summary: "done" });
    expect(result.isError).toBe(true);
    expect(result.output.problems).toEqual(["drafts/complaint.md is missing.", "drafts/rti.md is missing."]);
  });

  it("refuses when a draft fails checks, even if checks.json says it passed", async () => {
    put("drafts/complaint.md", GOOD_COMPLAINT);
    put("drafts/rti.md", "Dear sir, give me information.");
    put("checks.json", JSON.stringify({ "drafts/rti.md": { passed: true, checks: [] } }));
    const result = await run("finish_case", { summary: "done" });
    expect(result.isError).toBe(true);
    expect(result.output.problems).toHaveLength(1);
    expect(result.output.problems[0]).toContain("drafts/rti.md fails");
  });

  it("finishes when both drafts pass, and calls onFinish", async () => {
    put("drafts/complaint.md", GOOD_COMPLAINT);
    put("drafts/rti.md", GOOD_RTI);
    let summary = "";
    const withHook = createCaseTools("c1", { emit: () => {}, root, onFinish: (s) => (summary = s) });
    const result = await exec(withHook, "finish_case", { summary: "All prepared" });
    expect(result).toEqual({ finished: true, summary: "All prepared" });
    expect(summary).toBe("All prepared");
  });

  it("also checks first_appeal.md when it exists", async () => {
    put("drafts/complaint.md", GOOD_COMPLAINT);
    put("drafts/rti.md", GOOD_RTI);
    put("drafts/first_appeal.md", "Please help.");
    const result = await run("finish_case", { summary: "done" });
    expect(result.isError).toBe(true);
    expect(result.output.problems[0]).toContain("drafts/first_appeal.md fails");
  });

  describe("first appeal mode", () => {
    const GOOD_APPEAL = `Subject: First appeal under Section 19(1) of the RTI Act, 2005

To,
The First Appellate Authority,
Guwahati Municipal Corporation

My RTI application dated 05 September 2026 received no reply within 30 days. I request you to direct the PIO to provide the information.

[Your name]
[Your address]`;

    it("needs only first_appeal.md: the complaint and RTI are not required", async () => {
      const appealTools = createCaseTools("c1", { emit: () => {}, root, mode: "first_appeal" });
      const result = await exec(appealTools, "finish_case", { summary: "x" });
      expect(result.isError).toBe(true);
      expect(result.output.problems).toEqual(["drafts/first_appeal.md is missing."]);

      put("drafts/first_appeal.md", GOOD_APPEAL);
      const ok = await exec(appealTools, "finish_case", { summary: "Appeal ready" });
      expect(ok).toEqual({ finished: true, summary: "Appeal ready" });
    });

    it("refuses a failing appeal, and ignores a failing complaint or RTI", async () => {
      put("drafts/complaint.md", "broken");
      put("drafts/rti.md", "broken");
      put("drafts/first_appeal.md", "Please help.");
      const appealTools = createCaseTools("c1", { emit: () => {}, root, mode: "first_appeal" });
      const result = await exec(appealTools, "finish_case", { summary: "x" });
      expect(result.isError).toBe(true);
      expect(result.output.problems).toHaveLength(1);
      expect(result.output.problems[0]).toContain("drafts/first_appeal.md fails");
    });

    it("the default mode still needs the complaint and the RTI", async () => {
      put("drafts/first_appeal.md", GOOD_APPEAL);
      const result = await exec(tools, "finish_case", { summary: "x" });
      expect(result.isError).toBe(true);
      expect(result.output.problems).toEqual(["drafts/complaint.md is missing.", "drafts/rti.md is missing."]);
    });
  });

  it("does not call onFinish when refusing", async () => {
    let called = false;
    const withHook = createCaseTools("c1", { emit: () => {}, root, onFinish: () => (called = true) });
    await exec(withHook, "finish_case", { summary: "x" });
    expect(called).toBe(false);
  });
});

describe("unwrapToolResult", () => {
  it("unwraps a nested { output, isError } result", () => {
    expect(unwrapToolResult({ output: { output: { error: "nope" }, isError: true } })).toEqual({
      output: { error: "nope" },
      isError: true,
    });
  });

  it("leaves normal results and already-flagged errors alone", () => {
    expect(unwrapToolResult({ output: { ok: true } })).toBeUndefined();
    expect(unwrapToolResult({ output: "text" })).toBeUndefined();
    expect(unwrapToolResult({ output: null })).toBeUndefined();
    expect(unwrapToolResult({ output: { error: "x" }, isError: true })).toBeUndefined();
  });
});
