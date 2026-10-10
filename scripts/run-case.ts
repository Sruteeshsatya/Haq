// Usage: npm run run-case   (loads .env.local; calls the real model)
import fs from "node:fs";
import path from "node:path";
import { runCase } from "../lib/agent/runCase";
import { todayIST } from "../lib/server/http";
import type { CaseEvent } from "../lib/agent/events";
import { defaultCasesRoot, listCaseFiles, readCaseFile, writeCaseFile } from "../lib/tools/caseFiles";

const TEXT =
  "আমাৰ গুৱাহাটীৰ লেনটোত তিনিমাহ ধৰি এটা ডাঙৰ গাঁত হৈ আছে। দুজন মানুহ পৰি আঘাত পাইছে। অনুগ্ৰহ কৰি ৰাস্তাটো মেৰামতি কৰক।\n" +
  "(English: Our lane in Guwahati has had a big pothole for 3 months. Two people have fallen and been hurt. Please get the road repaired.)";

function today(): string {
  return todayIST();
}

function line(event: CaseEvent): string {
  switch (event.type) {
    case "start":
      return `[start] mode=${event.mode}`;
    case "text":
      return `[text] ${event.text.replace(/\s+/g, " ").slice(0, 300)}`;
    case "tool_call":
      return `[tool_call] ${event.toolName} ${JSON.stringify(event.input).slice(0, 200)}`;
    case "tool_result":
      return `[tool_result] ${event.toolName}${event.isError ? " (ERROR)" : ""} ${JSON.stringify(event.output).slice(0, 200)}`;
    case "file_written":
      return `[file_written] ${event.path} (${event.bytes} bytes)`;
    case "check": {
      const bad = event.checks.filter((c) => !c.passed).map((c) => c.id);
      return `[check] ${event.path} ${event.passed ? "PASS" : `FAIL ${bad.join(", ")}`}`;
    }
    case "done":
      return `[done] ${event.summary}`;
    case "error":
      return `[error] ${event.message}`;
  }
}

const caseId = `sample-${Date.now()}`;
const root = defaultCasesRoot();
await writeCaseFile(
  caseId,
  "facts.md",
  [
    "# Facts",
    "",
    "Language: as",
    "Place: Guwahati",
    `Date: ${today()}`,
    "Problem started: about 3 months ago",
    "",
    "## What the citizen wrote",
    TEXT,
    "",
  ].join("\n"),
  root,
);
// Add a tiny placeholder photo so the evidence/annexure path is exercised.
await writeCaseFile(caseId, "evidence/photo-1.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), root);

console.log(`Case ${caseId} (model ${process.env.HAQ_MODEL ?? "minimax/minimax-m2.5"})\n`);
const result = await runCase(caseId, (event) => console.log(line(event)));
console.log(`\nResult: ${result.status}${result.error ? ` - ${result.error}` : ""}`);

console.log("\nFiles:", (await listCaseFiles(caseId, root)).join(", "));
try {
  const checks = JSON.parse(await readCaseFile(caseId, "checks.json", root)) as Record<string, { passed: boolean }>;
  for (const [file, value] of Object.entries(checks)) console.log(`checks.json ${file}: ${value.passed ? "PASS" : "FAIL"}`);
} catch {
  console.log("No checks.json was written.");
}
console.log(`Case folder: ${path.join(root, caseId)}`);
if (!fs.existsSync(path.join(root, caseId, "drafts", "rti.md"))) process.exitCode = 1;
if (result.status !== "done") process.exitCode = 1;
