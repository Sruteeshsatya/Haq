import { readCaseFile, writeCaseFile } from "../tools/caseFiles";
import { ApiError, startRun, type ServiceOptions } from "./caseService";
import { applyAppealBlock, isRealDate } from "./facts";
import { claimRun, releaseRun, todayIST } from "./http";

export interface AppealInput {
  rtiFilingDate: unknown;
  reason: unknown;
}

/** Validates the appeal, writes the appeal block to facts.md and starts a first-appeal run. */
export async function startAppeal(caseId: string, input: AppealInput, options: ServiceOptions = {}): Promise<void> {
  if (!isRealDate(input.rtiFilingDate)) {
    throw new ApiError(400, "rtiFilingDate must be a real date in YYYY-MM-DD format.");
  }
  const today = todayIST();
  if (input.rtiFilingDate > today) throw new ApiError(400, "rtiFilingDate cannot be in the future.");
  if (input.reason !== "no_reply" && input.reason !== "unsatisfactory") {
    throw new ApiError(400, 'reason must be "no_reply" or "unsatisfactory".');
  }

  let rti = "";
  try {
    rti = await readCaseFile(caseId, "drafts/rti.md", options.root);
  } catch {
    rti = "";
  }
  if (!rti.trim()) throw new ApiError(409, "This case has no RTI draft yet, so there is nothing to appeal.");

  // Claim before any further await, so two requests cannot both start a run.
  if (!claimRun(caseId)) throw new ApiError(409, "A run is already in progress for this case.");
  try {
    const facts = await readCaseFile(caseId, "facts.md", options.root);
    const updated = applyAppealBlock(facts, {
      rtiFilingDate: input.rtiFilingDate,
      reason: input.reason,
      firstAppealDate: today,
    });
    await writeCaseFile(caseId, "facts.md", updated, options.root);
  } catch (error) {
    releaseRun(caseId);
    throw error;
  }
  startRun(caseId, "first_appeal", options);
}
