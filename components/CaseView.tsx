"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCase } from "./caseApi";
import CaseNotFound from "./CaseNotFound";
import DraftTab from "./DraftTab";
import LivePanel from "./LivePanel";
import RouteBadge from "./RouteBadge";
import SummaryTab from "./SummaryTab";
import Tabs from "./Tabs";
import TimelineTab from "./TimelineTab";
import type { CaseData } from "./types";
import { useCaseStream } from "./useCaseStream";
import { useDetails } from "./useDetails";
import WhereToFile from "./WhereToFile";

type TabId = "summary" | "complaint" | "rti" | "first_appeal" | "where" | "timeline";

export default function CaseView({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [data, setData] = useState<CaseData | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<TabId>("summary");
  // Name, address, phone and date: kept in this browser only (localStorage), never sent anywhere.
  const [details, changeDetails] = useDetails();

  const load = useCallback(async () => {
    const result = await fetchCase(caseId);
    if (result.kind === "ok") setData(result.data);
    else if (result.kind === "missing") setMissing(true);
    // on a network error keep what we have; the live panel shows connection problems
  }, [caseId]);

  // Initial load. The setState happens after the awaited fetch, not synchronously in the effect.
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const stream = useCaseStream(caseId, load);
  const hasAppeal = Boolean(data?.drafts.first_appeal);
  const tabs = useMemo(() => {
    const list: Array<{ id: TabId; label: string }> = [
      { id: "summary", label: "Summary" },
      { id: "complaint", label: "Complaint" },
      { id: "rti", label: "RTI" },
    ];
    if (hasAppeal) list.push({ id: "first_appeal", label: "First appeal" });
    list.push({ id: "where", label: "Where to file" }, { id: "timeline", label: "Timeline" });
    return list;
  }, [hasAppeal]);

  // When an appeal run finishes, jump to the new draft (adjusting state while rendering, once).
  const appealDone = hasAppeal && stream.sections.some((s) => s.mode === "first_appeal" && s.finished === "done");
  const [jumped, setJumped] = useState(false);
  if (appealDone && !jumped) {
    setJumped(true);
    setTab("first_appeal");
  }

  if (missing) return <CaseNotFound />;

  const ready = Boolean(data?.drafts.complaint || data?.drafts.rti);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="no-print mb-5">
        <Link href="/" className="text-base text-accent underline">← New case</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="no-print">
          <LivePanel sections={stream.sections} running={stream.running} reconnecting={stream.reconnecting} onRetry={() => router.push("/")} />
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <RouteBadge route={data?.route ?? null} />
          {!ready && stream.running && (
            <p className="no-print rounded-xl border border-dashed border-line px-4 py-6 text-center text-muted">
              Your drafts will appear here as soon as Haq writes them.
            </p>
          )}
          {data && (ready || !stream.running) && (
            <>
              <Tabs tabs={tabs} active={tab} onChange={setTab} />
              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
                {tab === "summary" && <SummaryTab text={data.summary.text} language={data.summary.language} />}
                {(tab === "complaint" || tab === "rti" || tab === "first_appeal") && (
                  <DraftTab
                    kind={tab}
                    data={data}
                    caseId={caseId}
                    details={details}
                    onDetails={changeDetails}
                    running={stream.running}
                    onAppealStarted={() => {
                      void load();
                      stream.resume();
                    }}
                  />
                )}
                {tab === "where" && <WhereToFile guide={data.filingGuide} sources={data.sources} />}
                {tab === "timeline" &&
                  (data.timeline ? (
                    <TimelineTab caseId={caseId} events={data.timeline.events} filingDate={data.timeline.filingDate} />
                  ) : (
                    <p className="text-muted">There are no deadlines for this case yet.</p>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
