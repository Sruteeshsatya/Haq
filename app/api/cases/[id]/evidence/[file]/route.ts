import fs from "node:fs/promises";
import { safeCasePath } from "../../../../../../lib/tools/caseFiles";
import { jsonError, parseCaseId, serverError } from "../../../../../../lib/server/http";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string; file: string }> },
): Promise<Response> {
  try {
    const params = await ctx.params;
    const id = parseCaseId(params.id);
    if (typeof id !== "string") return id;
    // A single file name only: no folders, and only photo extensions.
    const file = params.file;
    const ext = /^[A-Za-z0-9_-]+\.([A-Za-z0-9]+)$/.exec(file)?.[1]?.toLowerCase();
    const type = ext ? TYPES[ext] : undefined;
    if (!type) return jsonError(400, "Invalid file name.");
    let bytes: Buffer;
    try {
      bytes = await fs.readFile(safeCasePath(id, `evidence/${file}`));
    } catch {
      return jsonError(404, "File not found.");
    }
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(bytes.length),
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
