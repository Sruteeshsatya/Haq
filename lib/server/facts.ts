export const LANGUAGES = ["en", "hi", "as"] as const;
export type Language = (typeof LANGUAGES)[number];

export const MAX_TEXT_CHARS = 2000;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** Marker lines that make up the appeal block in facts.md. */
export const APPEAL_START = "<!-- first-appeal:start -->";
export const APPEAL_END = "<!-- first-appeal:end -->";

export type PhotoKind = { ext: "jpg" | "png" | "webp"; mime: "image/jpeg" | "image/png" | "image/webp" };

/** Detects the real image type from the first bytes. The MIME type sent by the client is not trusted. */
export function sniffImage(bytes: Uint8Array): PhotoKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, index) => bytes[index] === byte)) {
    return { ext: "png", mime: "image/png" };
  }
  const ascii = (start: number, length: number) =>
    String.fromCharCode(...Array.from(bytes.slice(start, start + length)));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

/** One line only: strips newlines and control characters so a field cannot inject extra facts lines. */
export function singleLine(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Quotes the citizen's text with "> " on every line. Facts lines such as "mode: first_appeal" typed
 * by the citizen then sit inside the quote and are plain text, not metadata.
 */
export function blockquote(text: string): string {
  return text
    // Unicode line/paragraph separators count as line breaks for some readers: make them real ones, so each part is quoted.
    .replace(/\r\n?|\u2028|\u2029/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

export interface FactsInput {
  date: string;
  language: Language;
  place: string;
  issue: string | null;
  text: string;
  photoNote?: string;
  exifLines?: string[];
}

export function buildFacts(input: FactsInput): string {
  const lines = [
    "# Facts",
    "",
    `Date: ${input.date}`,
    `Language: ${input.language}`,
    `Place: ${singleLine(input.place)}`,
    `Issue (guessed): ${input.issue ?? "unknown"}`,
  ];
  if (input.photoNote) lines.push(`Photo: ${singleLine(input.photoNote)}`);
  for (const line of input.exifLines ?? []) lines.push(singleLine(line));
  lines.push("", "## What the citizen wrote", "", blockquote(input.text), "");
  return lines.join("\n");
}

export interface AppealInput {
  rtiFilingDate: string;
  reason: "no_reply" | "unsatisfactory";
  firstAppealDate: string;
}

export function buildAppealBlock(input: AppealInput): string {
  return [
    APPEAL_START,
    "## First appeal",
    "",
    "mode: first_appeal",
    `RTI filed: ${input.rtiFilingDate}`,
    `Reason: ${input.reason}`,
    `First appeal date: ${input.firstAppealDate}`,
    APPEAL_END,
    "",
  ].join("\n");
}

/**
 * Matches an existing appeal block. The markers must start a line, so a marker typed by the citizen
 * (which is quoted with "> " in facts.md) can never be mistaken for ours.
 */
const APPEAL_BLOCK = /^<!-- first-appeal:start -->[ \t]*\r?\n[\s\S]*?^<!-- first-appeal:end -->[ \t]*(?:\r?\n|$)/m;

/** Adds the appeal block to facts.md, replacing any earlier block (a repeat appeal never stacks). */
export function applyAppealBlock(facts: string, input: AppealInput): string {
  const base = facts.replace(APPEAL_BLOCK, "").replace(/\s+$/, "");
  return `${base}\n\n${buildAppealBlock(input)}`;
}

export function isRealDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}
