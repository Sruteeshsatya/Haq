import fs from "node:fs";
import path from "node:path";

/** Smallest bytes that sniff as a JPEG. */
export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);

export const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

export function formRequest(
  fields: Record<string, string>,
  photo?: { bytes: Uint8Array; name?: string; type?: string },
): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  if (photo) {
    form.set("photo", new File([photo.bytes as BlobPart], photo.name ?? "photo.jpg", { type: photo.type ?? "image/jpeg" }));
  }
  return new Request("http://localhost/api/cases", { method: "POST", body: form });
}

export function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Writes files (relative paths) into <root>/<caseId>/. */
export function seedCase(root: string, caseId: string, files: Record<string, string | Uint8Array>): void {
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(root, caseId, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

export const jsonl = (events: Array<Record<string, unknown>>): string =>
  `${events.map((event) => JSON.stringify(event)).join("\n")}\n`;

export const tick = (ms = 10) => new Promise<void>((resolve) => setTimeout(resolve, ms));
