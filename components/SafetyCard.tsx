"use client";

import { useState } from "react";

/** Shown instead of creating a case when the text looks like a police or safety matter. */
export default function SafetyCard({ onContinue, busy }: { onContinue: () => void; busy: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText("112");
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section
      role="alert"
      aria-labelledby="safety-heading"
      className="flex flex-col gap-4 rounded-2xl border-2 border-[var(--warn-line)] bg-[var(--warn-bg)] p-4 text-[var(--warn-text)] sm:p-6"
    >
      <h2 id="safety-heading" className="text-xl font-bold">
        This sounds like a police or safety matter
      </h2>
      <p className="text-lg">
        Haq helps with civic problems like roads, water, electricity and ration cards. This sounds like a police or
        safety matter. If anyone is in danger, call 112 now. You can also report it at your nearest police station.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-5xl font-extrabold leading-none tracking-wide" aria-label="Emergency number 112">
          112
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="min-h-12 rounded-xl border border-[var(--warn-line)] bg-white px-5 py-2 text-lg font-semibold"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button
        type="button"
        onClick={onContinue}
        disabled={busy}
        className="min-h-12 rounded-xl border border-line bg-white px-5 py-2 text-left text-lg font-semibold text-foreground disabled:opacity-70"
      >
        It&apos;s a civic problem, continue anyway
      </button>
    </section>
  );
}
