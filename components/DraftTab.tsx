"use client";

import type { Details } from "../lib/client/draft";
import Annexure from "./Annexure";
import AppealForm from "./AppealForm";
import DetailsForm from "./DetailsForm";
import DraftView from "./DraftView";
import type { CaseData } from "./types";

/** Complaint, RTI or first appeal: details form, the draft, and (for the RTI) the appeal form. */
export default function DraftTab({
  kind,
  data,
  caseId,
  details,
  onDetails,
  running,
  onAppealStarted,
}: {
  kind: "complaint" | "rti" | "first_appeal";
  data: CaseData;
  caseId: string;
  details: Details;
  onDetails: (next: Details) => void;
  running: boolean;
  onAppealStarted: () => void;
}) {
  const markdown = data.drafts[kind];
  if (!markdown) return <p className="text-muted">This draft is not ready yet.</p>;
  return (
    <div className="flex flex-col gap-4">
      <DetailsForm details={details} onChange={onDetails} />
      <DraftView slug={kind} markdown={markdown} details={details} checks={data.checks?.[`drafts/${kind}.md`]}>
        {kind === "complaint" && <Annexure caseId={caseId} files={data.evidence} facts={data.facts} />}
      </DraftView>
      {kind === "rti" && (
        <AppealForm caseId={caseId} defaultDate={data.timeline?.filingDate ?? null} disabled={running} onStarted={onAppealStarted} />
      )}
    </div>
  );
}
