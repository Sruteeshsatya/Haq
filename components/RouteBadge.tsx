import type { RouteView } from "./types";

const LEVEL_NAMES = { city: "City", state: "State", central: "Central" } as const;

/** Where this case goes: city, state or central, plus an amber note when the office is not verified. */
export default function RouteBadge({ route }: { route: RouteView | null }) {
  if (!route) return null;
  return (
    <div className="flex flex-col gap-3">
      <p className="inline-flex flex-wrap items-baseline gap-x-2 rounded-xl bg-accent-soft px-4 py-2.5 text-lg font-semibold text-accent-strong">
        <span className="rounded-md bg-accent px-2 py-0.5 text-sm font-bold uppercase tracking-wide text-white">
          {LEVEL_NAMES[route.level]}
        </span>
        <span>{route.office}</span>
      </p>
      {route.note && (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-base">{route.note}</p>
      )}
      {!route.verified && (
        <div role="note" className="rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3 text-[var(--warn-text)]">
          <p className="font-bold">Please confirm this office before filing.</p>
          {route.verifyNote && <p className="mt-1 text-base">{route.verifyNote}</p>}
        </div>
      )}
    </div>
  );
}
