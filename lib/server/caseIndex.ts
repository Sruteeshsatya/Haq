import fs from "node:fs/promises";
import path from "node:path";
import { defaultCasesRoot } from "../tools/caseFiles";

export interface CaseIndexEntry {
  caseId: string;
  createdAt: string;
  title: string;
  issue: string | null;
  place: string;
  language: "en" | "hi" | "as";
}

const LOCK_KEY = Symbol.for("haq.indexLock");

function lockHolder(): { chain: Promise<unknown> } {
  const holder = globalThis as unknown as Record<symbol, { chain: Promise<unknown> } | undefined>;
  holder[LOCK_KEY] ??= { chain: Promise.resolve() };
  return holder[LOCK_KEY];
}

function indexPath(root: string): string {
  return path.join(root, "index.json");
}

/** Reads cases/index.json. A missing or corrupt file gives an empty list. */
export async function readIndex(root: string = defaultCasesRoot()): Promise<CaseIndexEntry[]> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(indexPath(root), "utf8"));
    return Array.isArray(parsed) ? (parsed as CaseIndexEntry[]) : [];
  } catch {
    return [];
  }
}

export function newestFirst(entries: CaseIndexEntry[]): CaseIndexEntry[] {
  return [...entries].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

/** OneDrive or antivirus can briefly lock a file on Windows; retry a few times. */
async function retry<T>(action: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      last = error;
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
  throw last;
}

/**
 * Adds an entry to index.json. Writes go through a queue (one at a time in this process)
 * and use a temp file plus rename, so a crash never leaves half a file.
 * Never throws: a failed index write must not fail the request.
 */
export function addToIndex(entry: CaseIndexEntry, root: string = defaultCasesRoot()): Promise<boolean> {
  const holder = lockHolder();
  const run = holder.chain.then(async () => {
    try {
      const entries = (await readIndex(root)).filter((item) => item.caseId !== entry.caseId);
      entries.push(entry);
      await fs.mkdir(root, { recursive: true });
      const temp = `${indexPath(root)}.${process.pid}.tmp`;
      await fs.writeFile(temp, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
      await retry(() => fs.rename(temp, indexPath(root)));
      return true;
    } catch (error) {
      console.error("[haq] could not update cases/index.json:", error);
      return false;
    }
  });
  holder.chain = run;
  return run;
}
