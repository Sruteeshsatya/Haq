import ReactMarkdown from "react-markdown";
import type { CaseData } from "./types";

/** The filing guide, then the source links the answer is based on (from routing.json and laws.json). */
export default function WhereToFile({ guide, sources }: { guide: string | null; sources: CaseData["sources"] }) {
  return (
    <div className="flex flex-col gap-6">
      {guide ? (
        <div className="prose-haq">
          <ReactMarkdown>{guide}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-muted">The filing guide is not ready yet.</p>
      )}
      {sources.length > 0 && (
        <section aria-labelledby="sources-heading" className="rounded-xl border border-line bg-surface p-4">
          <h3 id="sources-heading" className="text-base font-bold text-accent-strong">Sources</h3>
          <p className="mt-1 text-sm text-muted">Haq only uses these official pages. Check them before you file.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {sources.map((source) => (
              <li key={source.url} className="text-base">
                <span className="text-muted">{source.label}: </span>
                <a href={source.url} target="_blank" rel="noreferrer" className="break-all text-accent underline">
                  {source.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
