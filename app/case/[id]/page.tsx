import { Suspense } from "react";
import CaseView from "../../../components/CaseView";

// With cacheComponents, param access is runtime data: read it inside a Suspense boundary.
export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="mx-auto w-full max-w-2xl px-4 py-10 text-muted">Loading your case…</p>}>
      {params.then(({ id }) => (
        <CaseView caseId={id} />
      ))}
    </Suspense>
  );
}