"use client";

import { useState } from "react";
import type { TimelineItem, TimelineSection } from "../lib/client/timeline";

function Spinner() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="haq-dot inline-block h-2 w-2 rounded-full bg-accent" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </span>
  );
}

function Mark({ status }: { status: "running" | "ok" | "failed" }) {
  if (status === "running") return <Spinner />;
  if (status === "ok") return <span className="font-bold text-ok" aria-label="done">✓</span>;
  return <span className="font-bold text-bad" aria-label="did not work">!</span>;
}

function CheckBlock({ item }: { item: Extract<TimelineItem, { kind: "check" }> }) {
  const [open, setOpen] = useState(!item.passed);
  const failing = item.checks.filter((check) => !check.passed).length;
  return (
    <div
      className={`rounded-xl border p-3 ${
        item.fixed ? "haq-pop border-ok bg-white" : item.passed ? "border-line bg-white" : "border-bad bg-white"
      }`}
    >
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-start gap-2 text-left">
        <span className={`text-xl font-bold ${item.passed ? "text-ok" : "text-bad"}`} aria-hidden="true">
          {item.passed ? "✓" : "✗"}
        </span>
        <span className="flex-1">
          <span className="block font-semibold">
            {item.passed ? `Checked ${item.draft}: all ${item.checks.length} checks passed` : `Checked ${item.draft}: ${failing} to fix`}
          </span>
          {item.fixed && <span className="mt-0.5 block text-sm font-semibold text-ok">Fixed. It was failing before and now passes.</span>}
          {!item.passed && <span className="mt-0.5 block text-sm text-muted">Haq will fix this and check again.</span>}
        </span>
        <span className="text-sm text-muted" aria-hidden="true">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-2 flex flex-col gap-1.5 border-t border-line pt-2">
          {item.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-2 text-base">
              <span className={`font-bold ${check.passed ? "text-ok" : "text-bad"}`} aria-label={check.passed ? "passed" : "failed"}>
                {check.passed ? "✓" : "✗"}
              </span>
              <span>
                {check.label}
                {!check.passed && <span className="block text-sm text-muted">{check.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ item, retry }: { item: TimelineItem; retry?: () => void }) {
  switch (item.kind) {
    case "step":
      return (
        <li className="flex items-start gap-2">
          <span className="mt-0.5 w-5 text-center"><Mark status={item.status} /></span>
          <span>
            {item.label}
            {item.detail && <span className="block text-sm text-muted">{item.detail}</span>}
          </span>
        </li>
      );
    case "file":
      return (
        <li className="flex items-start gap-2 text-muted">
          <span className="mt-0.5 w-5 text-center" aria-hidden="true">▤</span>
          <span>Saved {item.path}</span>
        </li>
      );
    case "note":
      return <li className="ml-7 text-sm italic text-muted">{item.text}</li>;
    case "check":
      return <li><CheckBlock item={item} /></li>;
    case "error":
      return (
        <li role="alert" className="rounded-xl border border-bad bg-white p-3">
          <p className="font-semibold text-bad">Haq could not finish this.</p>
          <p className="mt-1 text-base">{item.message}</p>
          <p className="mt-1 text-sm text-muted">Please try again. If it keeps happening, start a new case in a few minutes.</p>
          {retry && (
            <button type="button" onClick={retry} className="mt-2 min-h-11 rounded-xl border border-line bg-surface px-4 py-2 font-semibold">
              Start a new case
            </button>
          )}
        </li>
      );
    case "done":
      return (
        <li className="rounded-xl bg-accent-soft p-3">
          <p className="font-semibold text-accent-strong">All done.</p>
          <p className="mt-1 text-base">{item.summary}</p>
        </li>
      );
  }
}

export default function LivePanel({
  sections,
  running,
  reconnecting,
  onRetry,
}: {
  sections: TimelineSection[];
  running: boolean;
  reconnecting: boolean;
  onRetry: () => void;
}) {
  // Once finished, the step list folds away on small screens so the drafts are not pushed far down.
  // It is always shown on large screens, where it sits beside the drafts.
  const [expanded, setExpanded] = useState(false);
  const showSteps = running || expanded;
  return (
    <section aria-labelledby="working-heading" aria-live="polite" className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="working-heading" className="flex items-center gap-3 text-xl font-bold text-accent-strong">
          {running ? "Haq is working" : "What Haq did"} {running && <Spinner />}
        </h2>
        {!running && sections.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="min-h-11 rounded-xl border border-line px-3 py-1 text-base font-semibold text-accent-strong lg:hidden"
          >
            {expanded ? "Hide steps" : "Show steps"}
          </button>
        )}
      </div>
      {reconnecting && <p className="mt-1 text-sm text-muted">Connection lost. Reconnecting…</p>}
      {sections.length === 0 && <p className="mt-3 text-muted">Getting started…</p>}
      <div className={`mt-3 flex-col gap-5 ${showSteps ? "flex" : "hidden lg:flex"}`}>
        {sections.map((section, index) => (
          <div key={section.id}>
            {(index > 0 || section.mode === "first_appeal") && (
              <h3 className="mb-2 border-t border-line pt-3 text-base font-bold text-accent-strong">
                {section.mode === "first_appeal" ? "Drafting your first appeal" : "Working again"}
              </h3>
            )}
            <ul className="flex flex-col gap-2.5">
              {section.items.map((item) => (
                <Row key={item.id} item={item} retry={onRetry} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
