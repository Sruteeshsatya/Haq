import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import CaseView from "../../../components/CaseView";
import { caseExists } from "../../../lib/server/http";
import { isValidCaseId } from "../../../lib/tools/caseFiles";

export const metadata: Metadata = {
  title: "Your case",
  description: "Your complaint, RTI application, filing guide and deadlines, prepared by Haq.",
  robots: { index: false },
};

async function Case({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isValidCaseId(id) || !(await caseExists(id))) notFound();
  return <CaseView caseId={id} />;
}

// With cacheComponents, param access is runtime data: read it inside a Suspense boundary.
export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="mx-auto w-full max-w-2xl px-4 py-10 text-muted">Loading your case…</p>}>
      <Case params={params} />
    </Suspense>
  );
}