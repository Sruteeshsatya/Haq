"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { fillPlaceholders, markdownToText, missingPlaceholders, type Details } from "../lib/client/draft";
import type { CheckResult } from "./types";

function ChecksBadge({ result }: { result: CheckResult | undefined }) {
  const [open, setOpen] = useState(false);
  if (!result) return null;
  const failing = result.checks.filter((check) => !check.passed).length;
  return (
    <div className="no-print rounded-xl border border-line bg-surface">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-2 px-4 py-2 text-left">
        <span className={`text-lg font-bold ${result.passed ? "text-ok" : "text-bad"}`} aria-hidden="true">{result.passed ? "✓" : "✗"}</span>
        <span className="flex-1 font-semibold">{result.passed ? "All checks passed" : `${failing} check${failing === 1 ? "" : "s"} need attention`}</span>
        <span className="text-sm text-muted" aria-hidden="true">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="flex flex-col gap-1.5 border-t border-line px-4 py-3">
          {result.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-2">
              <span className={`font-bold ${check.passed ? "text-ok" : "text-bad"}`}>{check.passed ? "✓" : "✗"}</span>
              <span>{check.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * One draft: markdown with the citizen's details filled in (browser only), a compact checks badge,
 * and Copy / Download .txt / Print buttons. Printing shows only this draft (see .print-only in globals.css).
 */
export default function DraftView({
  slug,
  markdown,
  details,
  checks,
  children,
}: {
  slug: string;
  markdown: string;
  details: Details;
  checks: CheckResult | undefined;
  children?: React.ReactNode;
}) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const filled = fillPlaceholders(markdown, details);
  const missing = missingPlaceholders(filled);
  const plain = markdownToText(filled);

  async function copy() {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied("yes");
    } catch {
      setCopied("no");
    }
    setTimeout(() => setCopied(null), 2500);
  }

  const button = "min-h-12 rounded-xl border border-line bg-surface px-4 py-2 text-base font-semibold hover:bg-accent-soft";
  return (
    <div className="flex flex-col gap-4">
      <ChecksBadge result={checks} />
      {missing.length > 0 && (
        <p className="no-print text-sm text-muted">
          Still to fill in: {missing.map((name) => `[${name}]`).join(", ")}. Use “Your details” above.
        </p>
      )}
      <div className="print-area">
        <div className="draft-paper prose-haq rounded-xl border border-line bg-white p-4 sm:p-6">
          <ReactMarkdown>{filled}</ReactMarkdown>
        </div>
      </div>
      <div className="no-print flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={button}>
          {copied === "yes" ? "Copied ✓" : copied === "no" ? "Could not copy" : "Copy"}
        </button>
        <button type="button" onClick={() => download(`haq-${slug}.txt`, plain)} className={button}>
          Download .txt
        </button>
        <button type="button" onClick={() => window.print()} className={button}>
          Print / Save as PDF
        </button>
      </div>
      {children}
    </div>
  );
}
