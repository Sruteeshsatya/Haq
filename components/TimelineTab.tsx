import type { TimelineEvent } from "./types";

const KIND_NAMES = { grievance: "Complaint", rti: "RTI", appeal: "Appeal" } as const;

function pretty(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Dates and what to do on each, straight from calc_deadlines (timeline.json). Nothing is computed here. */
export default function TimelineTab({ caseId, events, filingDate }: { caseId: string; events: TimelineEvent[]; filingDate: string }) {
  if (events.length === 0) return <p className="text-muted">There are no deadlines for this case yet.</p>;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base text-muted">
        Counted from {pretty(filingDate)}, the day you file. If you file on a different day, the dates move with it.
      </p>
      <a
        href={`/api/cases/${encodeURIComponent(caseId)}/calendar.ics`}
        download
        className="min-h-12 self-start rounded-xl bg-accent px-5 py-2.5 text-lg font-bold text-white hover:bg-accent-strong"
      >
        📅 Add to calendar
      </a>
      <ol className="relative ml-2 flex flex-col gap-5 border-l-2 border-line pl-5">
        {events.map((event, index) => (
          <li key={`${event.date}-${index}`} className="relative">
            <span className="absolute -left-[1.72rem] top-2 h-3 w-3 rounded-full border-2 border-accent bg-surface" aria-hidden="true" />
            <p className="text-lg font-bold">{pretty(event.date)}</p>
            <p className="font-semibold text-accent-strong">
              {event.label} <span className="ml-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-bold uppercase">{KIND_NAMES[event.kind] ?? event.kind}</span>
            </p>
            <p className="mt-1 text-base text-muted">{event.explanation}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
