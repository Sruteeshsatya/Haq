import { startAppeal } from "../../../../../lib/server/appealService";
import { ApiError } from "../../../../../lib/server/caseService";
import { caseExists, jsonError, jsonOk, parseCaseId, serverError } from "../../../../../lib/server/http";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const id = parseCaseId((await ctx.params).id);
    if (typeof id !== "string") return id;
    if (!(await caseExists(id))) return jsonError(404, "Case not found.");
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return jsonError(400, "Send a JSON body: { rtiFilingDate, reason }.");
    }
    if (!body || typeof body !== "object") return jsonError(400, "Send a JSON body: { rtiFilingDate, reason }.");
    const { rtiFilingDate, reason } = body as { rtiFilingDate?: unknown; reason?: unknown };
    await startAppeal(id, { rtiFilingDate, reason });
    return jsonOk({ caseId: id, status: "running", mode: "first_appeal" }, 202);
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.status, error.message);
    return serverError(error);
  }
}
