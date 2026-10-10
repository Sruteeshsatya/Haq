import { getCaseView } from "../../../../lib/server/caseView";
import { caseExists, jsonError, jsonOk, parseCaseId, serverError } from "../../../../lib/server/http";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const id = parseCaseId((await ctx.params).id);
    if (typeof id !== "string") return id;
    if (!(await caseExists(id))) return jsonError(404, "Case not found.");
    return jsonOk(await getCaseView(id));
  } catch (error) {
    return serverError(error);
  }
}
