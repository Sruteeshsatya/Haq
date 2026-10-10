import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listCaseFiles, readCaseFile, safeCasePath, writeCaseFile } from "../lib/tools/caseFiles";

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "haq-cases-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("safeCasePath", () => {
  it("returns a path inside <root>/<caseId>/", () => {
    const target = safeCasePath("case-1", "drafts/rti.md", root);
    expect(target).toBe(path.join(path.resolve(root), "case-1", "drafts", "rti.md"));
  });

  it("accepts letters, digits, underscore and hyphen in caseId", () => {
    expect(() => safeCasePath("Case_2026-10-10", "facts.md", root)).not.toThrow();
  });

  it("rejects invalid caseIds", () => {
    for (const id of ["", "..", "a/b", "a\\b", "a b", "case.1", "../x", "ca\0se", "केस"]) {
      expect(() => safeCasePath(id, "facts.md", root), id).toThrow(/Invalid caseId/);
    }
  });

  it("rejects '..' in any form", () => {
    for (const rel of ["../x", "a/../../x", "a/../b.md", "..\\x", "a\\..\\..\\x", ".."]) {
      expect(() => safeCasePath("c1", rel, root), rel).toThrow();
    }
  });

  it("rejects absolute paths", () => {
    for (const rel of ["/etc/passwd", "C:\\Windows\\win.ini", "C:/x", "\\\\server\\share\\x", "\\x"]) {
      expect(() => safeCasePath("c1", rel, root), rel).toThrow();
    }
  });

  it("rejects empty paths, folder-only paths and NUL bytes", () => {
    for (const rel of ["", "   ", ".", "./", "a\0b"]) {
      expect(() => safeCasePath("c1", rel, root), JSON.stringify(rel)).toThrow();
    }
  });

  it("normalises harmless './' segments", () => {
    expect(safeCasePath("c1", "./drafts//rti.md", root)).toBe(
      path.join(path.resolve(root), "c1", "drafts", "rti.md"),
    );
  });
});

describe("read/write/list case files", () => {
  it("writes (creating folders), reads back and lists files", async () => {
    await writeCaseFile("c1", "facts.md", "hello", root);
    await writeCaseFile("c1", "drafts/rti.md", "rti text", root);
    await writeCaseFile("c1", "evidence/photo-1.jpg", new Uint8Array([1, 2, 3]), root);

    expect(await readCaseFile("c1", "facts.md", root)).toBe("hello");
    expect(await readCaseFile("c1", "drafts/rti.md", root)).toBe("rti text");
    expect(await listCaseFiles("c1", root)).toEqual([
      "drafts/rti.md",
      "evidence/photo-1.jpg",
      "facts.md",
    ]);
  });

  it("overwrites an existing file", async () => {
    await writeCaseFile("c1", "plan.md", "v1", root);
    await writeCaseFile("c1", "plan.md", "v2", root);
    expect(await readCaseFile("c1", "plan.md", root)).toBe("v2");
  });

  it("keeps cases separate", async () => {
    await writeCaseFile("c1", "facts.md", "one", root);
    await writeCaseFile("c2", "facts.md", "two", root);
    expect(await listCaseFiles("c1", root)).toEqual(["facts.md"]);
    expect(await readCaseFile("c2", "facts.md", root)).toBe("two");
  });

  it("returns an empty list for a case that does not exist", async () => {
    expect(await listCaseFiles("missing", root)).toEqual([]);
  });

  it("throws when reading a file that does not exist", async () => {
    await expect(readCaseFile("c1", "nope.md", root)).rejects.toThrow();
  });

  it("refuses to read or write outside the case folder", async () => {
    fs.writeFileSync(path.join(root, "secret.txt"), "secret");
    await expect(readCaseFile("c1", "../secret.txt", root)).rejects.toThrow();
    await expect(writeCaseFile("c1", "../evil.txt", "x", root)).rejects.toThrow();
    await expect(writeCaseFile("../evil", "x.txt", "x", root)).rejects.toThrow(/Invalid caseId/);
    await expect(listCaseFiles("../x", root)).rejects.toThrow(/Invalid caseId/);
    expect(fs.existsSync(path.join(root, "evil.txt"))).toBe(false);
  });
});
