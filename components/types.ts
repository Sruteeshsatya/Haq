/** Shape of GET /api/cases/[id] (see memory-bank/activeContext.md). */
export interface CheckResult {
  kind: string;
  passed: boolean;
  checks: Array<{ id: string; label: string; passed: boolean; hint: string }>;
}

export interface TimelineEvent {
  date: string;
  label: string;
  kind: "grievance" | "rti" | "appeal";
  explanation: string;
}

export interface RouteView {
  covered: boolean;
  level: "city" | "state" | "central";
  office: string;
  verified: boolean;
  verifyNote: string | null;
  note: string | null;
  grievanceKey: string | null;
  rtiKey: string | null;
  rtiPio: string | null;
}

export interface CaseData {
  caseId: string;
  facts: string | null;
  route: RouteView | null;
  sources: Array<{ label: string; url: string }>;
  timeline: { filingDate: string; firstAppealDate: string | null; events: TimelineEvent[] } | null;
  checks: Record<string, CheckResult> | null;
  drafts: { complaint: string | null; rti: string | null; first_appeal: string | null };
  filingGuide: string | null;
  summary: { language: string; text: string | null };
  evidence: string[];
  status: "running" | "done" | "error";
  error: string | null;
}
