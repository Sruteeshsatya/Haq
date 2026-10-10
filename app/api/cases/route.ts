// No `runtime` / `dynamic` exports: with cacheComponents enabled, Next rejects them (Node.js is the default
// and route handlers already run at request time). The background run needs a long-lived Node server.
import { ApiError, createCase } from "../../../lib/server/caseService";
import { newestFirst, readIndex } from "../../../lib/server/caseIndex";
import { jsonError, jsonOk, serverError } from "../../../lib/server/http";
import { isSafetyCase } from "../../../lib/tools/text";

// A little more than the 5 MB photo limit, for the form fields and multipart framing.
const MAX_BODY_BYTES = 6 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  try {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return jsonError(413, "The upload is too large (max 5 MB photo).");
    }
    const type = request.headers.get("content-type") ?? "";
    if (!type.toLowerCase().includes("multipart/form-data")) {
      return jsonError(415, "Send the form as multipart/form-data.");
    }
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return jsonError(400, "The form could not be read.");
    }
    const text = form.get("text");
    // Haq is for civic grievances. A safety or crime report is referred out unless the citizen confirms.
    if (typeof text === "string" && isSafetyCase(text) && form.get("confirmCivic") !== "1") {
      return jsonError(422, "safety_referral");
    }
    const photo = form.get("photo");
    const caseId = await createCase({
      text,
      language: form.get("language"),
      place: form.get("place"),
      photo: photo instanceof File ? photo : null,
    });
    return jsonOk({ caseId }, 201);
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.status, error.message);
    return serverError(error);
  }
}

export async function GET(): Promise<Response> {
  try {
    return jsonOk(newestFirst(await readIndex()));
  } catch (error) {
    return serverError(error);
  }
}
