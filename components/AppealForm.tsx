"use client";

import { useState } from "react";

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** "No reply yet?" -> POST /api/cases/[id]/appeal. The page then resumes the live timeline. */
export default function AppealForm({
  caseId,
  defaultDate,
  disabled,
  onStarted,
}: {
  caseId: string;
  defaultDate: string | null;
  disabled: boolean;
  onStarted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate ?? "");
  const [reason, setReason] = useState<"no_reply" | "unsatisfactory">("no_reply");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!date) return setError("Please enter the date you filed your RTI.");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/cases/${encodeURIComponent(caseId)}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rtiFilingDate: date, reason }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      setOpen(false);
      setBusy(false);
      onStarted();
    } catch {
      setError("Could not reach Haq. Check your internet connection and try again.");
      setBusy(false);
    }
  }

  return (
    <section className="no-print mt-6 rounded-xl border border-line bg-surface p-4" aria-labelledby="appeal-heading">
      <h3 id="appeal-heading" className="text-lg font-bold text-accent-strong">No reply yet?</h3>
      <p className="mt-1 text-base text-muted">
        If the office has not answered within 30 days, or you are not happy with the answer, you can appeal.
      </p>
      {!open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="mt-3 min-h-12 rounded-xl bg-accent px-5 py-2 text-lg font-bold text-white hover:bg-accent-strong disabled:opacity-60"
        >
          Draft the first appeal
        </button>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-base font-semibold">
            Date you filed your RTI
            <input
              type="date"
              required
              max={today()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="min-h-12 rounded-xl border border-line bg-white px-3 py-2 text-lg font-normal"
            />
          </label>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-base font-semibold">Why are you appealing?</legend>
            {[
              ["no_reply", "I got no reply"],
              ["unsatisfactory", "The reply was unsatisfactory"],
            ].map(([value, label]) => (
              <label key={value} className="flex min-h-11 items-center gap-3 text-lg">
                <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value as typeof reason)} className="h-5 w-5 accent-[var(--accent)]" />
                {label}
              </label>
            ))}
          </fieldset>
          {error && <p role="alert" className="text-base text-bad">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="min-h-12 rounded-xl bg-accent px-5 py-2 text-lg font-bold text-white hover:bg-accent-strong disabled:opacity-60">
              {busy ? "Starting…" : "Draft my appeal"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-xl border border-line bg-surface px-5 py-2 text-lg font-semibold">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
