"use client";

import type { Details } from "../lib/client/draft";

const FIELDS: Array<{ key: keyof Details; label: string; autoComplete: string; type?: string }> = [
  { key: "name", label: "Your name", autoComplete: "name" },
  { key: "address", label: "Your address", autoComplete: "street-address" },
  { key: "phone", label: "Your phone", autoComplete: "tel", type: "tel" },
  { key: "date", label: "Date", autoComplete: "off" },
];

/** The "Your details" form. Values fill the placeholders in the displayed text and stay in this browser. */
export default function DetailsForm({ details, onChange }: { details: Details; onChange: (next: Details) => void }) {
  return (
    <details className="no-print rounded-xl border border-line bg-surface" open>
      <summary className="min-h-12 cursor-pointer px-4 py-3 text-base font-semibold text-accent-strong">Your details</summary>
      <div className="border-t border-line px-4 pb-4 pt-3">
        <p className="mb-3 text-sm text-muted">
          These fill in [Your name], [Your address], [Your phone] and [Date] in the drafts below. They are saved only in
          this browser and are never sent to Haq&apos;s server.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className={`flex flex-col gap-1 text-base font-semibold ${field.key === "address" ? "sm:col-span-2" : ""}`}>
              {field.label}
              <input
                type={field.type ?? "text"}
                value={details[field.key]}
                autoComplete={field.autoComplete}
                onChange={(event) => onChange({ ...details, [field.key]: event.target.value })}
                className="min-h-12 rounded-xl border border-line bg-white px-3 py-2 text-lg font-normal"
              />
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
