"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface Entry {
  caseId: string;
  createdAt: string;
  title: string;
  issue: string | null;
  place: string;
  language: string;
}

const ISSUE_NAMES: Record<string, string> = {
  road_pothole: "Road / pothole",
  streetlight: "Streetlight",
  garbage: "Garbage",
  drainage: "Drainage",
  water_supply: "Water supply",
  electricity: "Electricity",
  ration_card: "Ration card",
  post_office: "Post office",
  railways: "Railways",
  passport: "Passport",
};

function when(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** "Recent cases" from GET /api/cases. Shows nothing when there are none or the list cannot load. */
export default function RecentCases() {
  const [cases, setCases] = useState<Entry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/cases", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: unknown) => {
        if (!cancelled) setCases(Array.isArray(data) ? (data as Entry[]).slice(0, 8) : []);
      })
      .catch(() => {
        if (!cancelled) setCases([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!cases || cases.length === 0) return null;
  return (
    <section aria-labelledby="recent-heading" className="mt-10">
      <h2 id="recent-heading" className="text-lg font-bold text-accent-strong">Recent cases</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {cases.map((entry) => (
          <li key={entry.caseId}>
            <Link
              href={`/case/${entry.caseId}`}
              className="block rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-accent"
            >
              <span className="block font-semibold">{entry.title || "Untitled case"}</span>
              <span className="mt-0.5 block text-sm text-muted">
                {[entry.issue ? ISSUE_NAMES[entry.issue] ?? entry.issue : null, entry.place || null, when(entry.createdAt)]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
