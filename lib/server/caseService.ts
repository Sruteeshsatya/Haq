import crypto from "node:crypto";
import exifr from "exifr";
import { runCase, type RunCaseOptions } from "../agent/runCase";
import { writeCaseFile } from "../tools/caseFiles";
import { guessIssueType } from "../tools/findAuthority";
import { addToIndex } from "./caseIndex";
import {
  buildFacts,
  LANGUAGES,
  MAX_PHOTO_BYTES,
  MAX_TEXT_CHARS,
  sniffImage,
  singleLine,
  type Language,
} from "./facts";
import { claimRun, releaseRun, todayIST } from "./http";

/** A failure the route turns into a clean JSON error. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ServiceOptions {
  root?: string;
  /** Test hook: replaces the background agent run. */
  start?: (caseId: string, mode: "new" | "first_appeal") => Promise<unknown>;
  runOptions?: RunCaseOptions;
}

export function newCaseId(now: number = Date.now()): string {
  return `${now.toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
}

/** Starts the agent in the background (never awaited by the request). Releases the run lock when finished. */
export function startRun(caseId: string, mode: "new" | "first_appeal", options: ServiceOptions = {}): void {
  const run = options.start
    ? options.start(caseId, mode)
    : runCase(caseId, undefined, { ...options.runOptions, root: options.root, mode });
  void Promise.resolve(run)
    .catch((error) => console.error("[haq] background run crashed:", error))
    .finally(() => releaseRun(caseId));
}

type ExifData = { DateTimeOriginal?: Date | string; latitude?: number; longitude?: number };

async function exifLines(bytes: Uint8Array): Promise<string[]> {
  try {
    const data = (await exifr.parse(Buffer.from(bytes), {
      gps: true,
      pick: ["DateTimeOriginal", "latitude", "longitude"],
    })) as ExifData | undefined;
    if (!data) return [];
    const lines: string[] = [];
    if (typeof data.latitude === "number" && typeof data.longitude === "number") {
      lines.push(`Photo GPS: ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`);
    }
    if (data.DateTimeOriginal) {
      const when =
        data.DateTimeOriginal instanceof Date ? data.DateTimeOriginal.toISOString() : String(data.DateTimeOriginal);
      lines.push(`Photo taken: ${when}`);
    }
    return lines;
  } catch {
    return [];
  }
}

export interface CreateCaseInput {
  text: unknown;
  language: unknown;
  place: unknown;
  photo: File | null;
}

/** Validates the form, writes facts.md and the photo, updates the index and starts the run. Returns the caseId. */
export async function createCase(input: CreateCaseInput, options: ServiceOptions = {}): Promise<string> {
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!text) throw new ApiError(400, "Please describe the problem.");
  if (text.length > MAX_TEXT_CHARS) {
    throw new ApiError(400, `The description is too long (max ${MAX_TEXT_CHARS} characters).`);
  }
  const languageRaw = typeof input.language === "string" && input.language ? input.language : "en";
  if (!(LANGUAGES as readonly string[]).includes(languageRaw)) {
    throw new ApiError(400, 'Language must be "en", "hi" or "as".');
  }
  const language = languageRaw as Language;
  const place = typeof input.place === "string" ? singleLine(input.place).slice(0, 120) : "";

  let photoBytes: Uint8Array | null = null;
  let kind: ReturnType<typeof sniffImage> = null;
  if (input.photo && input.photo.size > 0) {
    if (input.photo.size > MAX_PHOTO_BYTES) throw new ApiError(413, "The photo is too large (max 5 MB).");
    photoBytes = new Uint8Array(await input.photo.arrayBuffer());
    kind = sniffImage(photoBytes);
    if (!kind) throw new ApiError(415, "The photo must be a JPEG, PNG or WebP image.");
  }

  const issue = guessIssueType(text);
  const caseId = newCaseId();
  const facts = buildFacts({
    date: todayIST(),
    language,
    place,
    issue,
    text,
    photoNote: kind ? `evidence/photo-1.${kind.ext}` : undefined,
    exifLines: photoBytes ? await exifLines(photoBytes) : [],
  });

  await writeCaseFile(caseId, "facts.md", facts, options.root);
  if (photoBytes && kind) await writeCaseFile(caseId, `evidence/photo-1.${kind.ext}`, photoBytes, options.root);

  const title = singleLine(text).slice(0, 80);
  await addToIndex({ caseId, createdAt: new Date().toISOString(), title, issue, place, language }, options.root);

  claimRun(caseId); // a brand-new id cannot already be running
  startRun(caseId, "new", options);
  return caseId;
}
