import fs from "node:fs/promises";
import path from "node:path";

const CASE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Default folder that holds all cases: <cwd>/cases, or HAQ_CASES_DIR when set (used by tests). */
export function defaultCasesRoot(): string {
  const override = process.env.HAQ_CASES_DIR?.trim();
  return override ? path.resolve(override) : path.join(process.cwd(), "cases");
}

/** True when the value is a safe case id: letters, digits, "_" and "-" only. */
export function isValidCaseId(caseId: unknown): caseId is string {
  return typeof caseId === "string" && CASE_ID_PATTERN.test(caseId);
}

/**
 * Returns the absolute path of relPath inside <root>/<caseId>/.
 * Throws for an invalid caseId, an empty path, absolute paths, "..", NUL bytes,
 * or anything that would resolve outside the case folder.
 */
export function safeCasePath(
  caseId: string,
  relPath: string,
  root: string = defaultCasesRoot(),
): string {
  if (typeof caseId !== "string" || !CASE_ID_PATTERN.test(caseId)) {
    throw new Error("Invalid caseId: use only letters, digits, '_' and '-'.");
  }
  if (typeof relPath !== "string" || relPath.trim() === "") {
    throw new Error("Path must be a non-empty relative path.");
  }
  if (relPath.includes("\0")) throw new Error("Path contains an invalid character.");
  if (
    path.posix.isAbsolute(relPath) ||
    path.win32.isAbsolute(relPath) ||
    /^[A-Za-z]:/.test(relPath)
  ) {
    throw new Error("Absolute paths are not allowed.");
  }
  const segments = relPath.split(/[\\/]+/).filter((segment) => segment !== "" && segment !== ".");
  if (segments.includes("..")) throw new Error("'..' is not allowed in paths.");
  if (segments.length === 0) throw new Error("Path must point to a file inside the case folder.");

  const caseDir = path.resolve(root, caseId);
  const resolved = path.resolve(caseDir, ...segments);
  if (!resolved.startsWith(caseDir + path.sep)) {
    throw new Error("Path is outside the case folder.");
  }
  return resolved;
}

export async function readCaseFile(
  caseId: string,
  relPath: string,
  root: string = defaultCasesRoot(),
): Promise<string> {
  return fs.readFile(safeCasePath(caseId, relPath, root), "utf8");
}

export async function writeCaseFile(
  caseId: string,
  relPath: string,
  content: string | Uint8Array,
  root: string = defaultCasesRoot(),
): Promise<void> {
  const target = safeCasePath(caseId, relPath, root);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

/** Lists all files in the case folder (recursive), as sorted forward-slash relative paths. */
export async function listCaseFiles(
  caseId: string,
  root: string = defaultCasesRoot(),
): Promise<string[]> {
  if (!CASE_ID_PATTERN.test(caseId)) {
    throw new Error("Invalid caseId: use only letters, digits, '_' and '-'.");
  }
  const caseDir = path.resolve(root, caseId);
  const files: string[] = [];

  async function walk(dir: string, prefix: string): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), rel);
      else if (entry.isFile()) files.push(rel);
    }
  }

  await walk(caseDir, "");
  return files.sort();
}
