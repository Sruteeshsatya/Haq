import { caseExists, jsonError, parseCaseId, serverError } from "../../../../../lib/server/http";
import { sseResponse } from "../../../../../lib/server/sse";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const id = parseCaseId((await ctx.params).id);
    if (typeof id !== "string") return id;
    if (!(await caseExists(id))) return jsonError(404, "Case not found.");
    return sseResponse(id, request);
  } catch (error) {
    return serverError(error);
  }
}
