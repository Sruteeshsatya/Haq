import { toIcs, type DeadlineEvent } from "../../../../../lib/tools/calcDeadlines";
import { readCaseFile } from "../../../../../lib/tools/caseFiles";
import { jsonError, parseCaseId, serverError } from "../../../../../lib/server/http";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const id = parseCaseId((await ctx.params).id);
    if (typeof id !== "string") return id;
    let events: DeadlineEvent[];
    try {
      const timeline = JSON.parse(await readCaseFile(id, "timeline.json")) as { events?: DeadlineEvent[] };
      events = Array.isArray(timeline.events) ? timeline.events : [];
    } catch {
      return jsonError(404, "This case has no timeline yet.");
    }
    return new Response(toIcs(events), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="haq-${id}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
