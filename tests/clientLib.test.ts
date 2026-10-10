import { describe, expect, it } from "vitest";
import {
  DETAILS_KEY,
  EMPTY_DETAILS,
  fillPlaceholders,
  loadDetails,
  markdownToText,
  missingPlaceholders,
  saveDetails,
} from "../lib/client/draft";
import { formatTaken, mapsUrl, parsePhotoMeta, photoProblem, speechLang } from "../lib/client/facts";
import { isRunning, reduceEvents, toolLabel, type StreamEvent } from "../lib/client/timeline";
import { pickVoice } from "../components/SummaryTab";

let n = 0;
const ev = (event: Record<string, unknown>): StreamEvent => ({ ts: 1, eventId: (n += 1), ...event }) as unknown as StreamEvent;
const check = (path: string, passed: boolean) =>
  ev({ type: "check", kind: "rti", path, passed, checks: [{ id: "a", label: "Has a thing", passed, hint: "add it" }] });

describe("friendly tool labels", () => {
  it("never shows raw tool names", () => {
    expect(toolLabel("find_authority", {})).toBe("Finding the responsible office");
    expect(toolLabel("lookup_law", {})).toBe("Checking the law and portal");
    expect(toolLabel("calc_deadlines", {})).toBe("Calculating your deadlines");
    expect(toolLabel("finish_case", {})).toBe("Finishing up");
    expect(toolLabel("write_case_file", { path: "drafts/rti.md" })).toBe("Writing your RTI application");
    expect(toolLabel("write_case_file", { path: "filing_guide.md" })).toBe("Writing the filing guide");
    expect(toolLabel("check_draft", { path: "drafts/complaint.md", kind: "complaint" })).toBe("Checking your complaint");
    expect(toolLabel("write_case_file", undefined)).toBe("Writing a file");
    expect(toolLabel("something_new", {})).toBe("Working");
  });
});

describe("reduceEvents (live timeline)", () => {
  it("opens a new section at every start event (the appeal run)", () => {
    n = 0;
    const sections = reduceEvents([
      ev({ type: "start", mode: "new" }),
      ev({ type: "text", text: "hello" }),
      ev({ type: "done", summary: "ok" }),
      ev({ type: "start", mode: "first_appeal" }),
      ev({ type: "tool_call", toolName: "find_authority", toolCallId: "c1", input: {} }),
    ]);
    expect(sections.map((s) => [s.mode, s.finished])).toEqual([["new", "done"], ["first_appeal", "running"]]);
    expect(isRunning(sections)).toBe(true);
    expect(isRunning(sections.slice(0, 1))).toBe(false);
  });

  it("marks a step running, then ok or failed with the error text", () => {
    n = 0;
    const calls = [
      ev({ type: "tool_call", toolName: "lookup_law", toolCallId: "a", input: {} }),
      ev({ type: "tool_call", toolName: "check_draft", toolCallId: "b", input: { path: "drafts/rti.md" } }),
    ];
    let items = reduceEvents(calls)[0].items;
    expect(items.map((i) => i.kind === "step" && i.status)).toEqual(["running", "running"]);
    items = reduceEvents([
      ...calls,
      ev({ type: "tool_result", toolName: "lookup_law", toolCallId: "a", output: { found: true }, isError: false }),
      ev({ type: "tool_result", toolName: "check_draft", toolCallId: "b", output: { error: "nope" }, isError: true }),
    ])[0].items;
    expect(items[0]).toMatchObject({ kind: "step", status: "ok" });
    expect(items[1]).toMatchObject({ kind: "step", status: "failed", detail: "nope" });
  });

  it("flags a draft that failed and then passes as fixed (the demo moment)", () => {
    n = 0;
    const items = reduceEvents([
      check("drafts/complaint.md", false),
      check("drafts/rti.md", true),
      check("drafts/complaint.md", false),
      check("drafts/complaint.md", true),
    ])[0].items;
    const flags = items.map((i) => (i.kind === "check" ? [i.path, i.passed, i.fixed] : null));
    expect(flags).toEqual([
      ["drafts/complaint.md", false, false],
      ["drafts/rti.md", true, false], // passed first time: not "fixed"
      ["drafts/complaint.md", false, false],
      ["drafts/complaint.md", true, true],
    ]);
  });

  it("hides bookkeeping files, keeps notes and errors", () => {
    n = 0;
    const [section] = reduceEvents([
      ev({ type: "file_written", path: "routing.json", bytes: 1 }),
      ev({ type: "file_written", path: "checks.json", bytes: 1 }),
      ev({ type: "file_written", path: "drafts/rti.md", bytes: 1 }),
      ev({ type: "text", text: "thinking" }),
      ev({ type: "error", message: "Timed out" }),
    ]);
    expect(section.items.map((i) => i.kind)).toEqual(["file", "note", "error"]);
    expect(section.finished).toBe("error");
    expect(isRunning([section])).toBe(false);
  });

  it("works when the stream resumes mid-run (no start event yet)", () => {
    n = 0;
    expect(reduceEvents([ev({ type: "text", text: "x" })])).toHaveLength(1);
    expect(reduceEvents([])).toEqual([]);
    expect(isRunning([])).toBe(true);
  });
});

describe("draft placeholders (browser only)", () => {
  const draft = "Dear Sir,\nI, [Your name], of [Your address], phone [Your phone], on [Date].";
  const details = { name: "Ravi", address: "Lane 3, Guwahati", phone: "98765", date: "2026-10-10" };

  it("fills the four placeholders and leaves empty ones alone", () => {
    expect(fillPlaceholders(draft, details)).toBe("Dear Sir,\nI, Ravi, of Lane 3, Guwahati, phone 98765, on 2026-10-10.");
    expect(fillPlaceholders(draft, { ...details, phone: "  ", date: "" })).toContain("[Your phone]");
    expect(fillPlaceholders(draft, EMPTY_DETAILS)).toBe(draft);
  });

  it("keeps special replacement patterns in typed values literal", () => {
    expect(fillPlaceholders("[Your name]", { ...EMPTY_DETAILS, name: "A$&B$1$$" })).toBe("A$&B$1$$");
  });

  it("lists what is still missing", () => {
    expect(missingPlaceholders(draft)).toEqual(["Your name", "Your address", "Your phone", "Date"]);
    expect(missingPlaceholders(fillPlaceholders(draft, { ...details, date: "" }))).toEqual(["Date"]);
  });

  it("saves and loads details through storage, tolerating bad data", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    saveDetails(storage, details);
    expect(store.has(DETAILS_KEY)).toBe(true);
    expect(loadDetails(storage)).toEqual(details);
    store.set(DETAILS_KEY, "{not json");
    expect(loadDetails(storage)).toEqual(EMPTY_DETAILS);
    store.set(DETAILS_KEY, JSON.stringify({ name: 5 }));
    expect(loadDetails(storage).name).toBe("");
    expect(() => saveDetails({ setItem: () => { throw new Error("full"); } }, details)).not.toThrow();
  });

  it("makes plain text for Copy and Download", () => {
    const text = markdownToText("# Title\n\n**Subject:** Pothole\n\n1. First\n2. Second\n\n- item\n\n[link](https://x.in)");
    expect(text).toBe("Title\n\nSubject: Pothole\n\n1. First\n2. Second\n\n- item\n\nlink (https://x.in)");
  });
});

describe("photo and speech helpers", () => {
  it("checks type and size in the browser", () => {
    expect(photoProblem({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(photoProblem({ type: "image/webp", size: 5 * 1024 * 1024 })).toBeNull();
    expect(photoProblem({ type: "image/gif", size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(photoProblem({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });

  it("reads photo date and GPS from the metadata lines only, not from the citizen's text", () => {
    const facts = "# Facts\n\nPhoto GPS: 26.14452, 91.73621\nPhoto taken: 2026-07-01T10:20:30.000Z\n\n## What the citizen wrote\n\n> Photo GPS: 1, 2";
    expect(parsePhotoMeta(facts)).toEqual({ gps: "26.14452, 91.73621", taken: "2026-07-01T10:20:30.000Z" });
    expect(parsePhotoMeta("# Facts\n\n## What the citizen wrote\n\n> Photo GPS: 1, 2")).toEqual({ gps: null, taken: null });
    expect(parsePhotoMeta(null)).toEqual({ gps: null, taken: null });
    expect(formatTaken("2026-07-01T10:20:30.000Z")).toBe("2026-07-01");
    expect(mapsUrl("26.14452, 91.73621")).toBe("https://www.google.com/maps?q=26.14452,91.73621");
    expect(mapsUrl("javascript:alert(1)")).toBeNull();
  });

  it("maps languages to speech codes", () => {
    expect([speechLang("en"), speechLang("hi"), speechLang("as"), speechLang("xx")]).toEqual(["en-IN", "hi-IN", "as-IN", "en-IN"]);
  });

  it("read aloud falls back from the case language to hi-IN, then en-IN, then says there is no voice", () => {
    const voices = [{ lang: "en-IN" }, { lang: "hi-IN" }, { lang: "en-US" }];
    expect(pickVoice(voices, "hi")).toMatchObject({ voice: { lang: "hi-IN" }, usedFallback: false });
    expect(pickVoice(voices, "as")).toMatchObject({ voice: { lang: "hi-IN" }, usedFallback: true });
    expect(pickVoice([{ lang: "en_IN" }], "as")).toMatchObject({ voice: { lang: "en_IN" }, usedFallback: true });
    expect(pickVoice([{ lang: "fr-FR" }], "as")).toBeNull();
    expect(pickVoice([], "en")).toBeNull();
  });
});
