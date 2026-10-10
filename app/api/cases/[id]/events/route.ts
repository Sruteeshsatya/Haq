import { caseExists, jsonError, parseCaseId, serverError } from "../../../../../lib/server/http";
import { sseResponse } from "../../../../../lib/server/sse";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const id = parseCaseId((await ctx.params).id);
    if (typeof id !== "string") return id;
    if (!(await caseExists(id))) return jsonError(404, "Case not found.");
    // Browsers cannot set Last-Event-ID on a new EventSource, so `?after=N` resumes after line N too.
    const after = Number(new URL(request.url).searchParams.get("after"));
    return sseResponse(id, request, { afterLine: Number.isInteger(after) && after > 0 ? after : undefined });
  } catch (error) {
    return serverError(error);
  }
}
