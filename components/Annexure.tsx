import { formatTaken, mapsUrl, parsePhotoMeta } from "../lib/client/facts";

/** The uploaded photo as "Annexure 1", with the EXIF date and place from facts.md when they exist. */
export default function Annexure({ caseId, files, facts }: { caseId: string; files: string[]; facts: string | null }) {
  const photo = files.find((file) => /\.(jpe?g|png|webp)$/i.test(file));
  if (!photo) return null;
  const meta = parsePhotoMeta(facts);
  const url = `/api/cases/${encodeURIComponent(caseId)}/evidence/${encodeURIComponent(photo)}`;
  const map = meta.gps ? mapsUrl(meta.gps) : null;
  return (
    <figure className="no-print rounded-xl border border-line bg-surface p-4">
      <figcaption className="mb-2 text-base font-bold text-accent-strong">Annexure 1: photo of the problem</figcaption>
      {/* eslint-disable-next-line @next/next/no-img-element -- served by our own API, size unknown */}
      <img src={url} alt="The photo you uploaded" className="max-h-80 w-full rounded-lg border border-line object-contain bg-white" />
      <p className="mt-2 text-sm text-muted">
        {meta.taken ? `Taken on ${formatTaken(meta.taken)}.` : "The photo has no date stored in it."}{" "}
        {meta.gps ? (
          <>
            Location in the photo: {map ? <a className="text-accent underline" href={map} target="_blank" rel="noreferrer">{meta.gps}</a> : meta.gps}.
          </>
        ) : (
          "The photo has no location stored in it."
        )}
      </p>
      <p className="mt-1 text-sm text-muted">Attach this photo when you file the complaint.</p>
    </figure>
  );
}
