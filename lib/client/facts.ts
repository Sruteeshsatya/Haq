export interface PhotoMeta {
  taken: string | null;
  gps: string | null;
}

/** Reads the metadata lines the server wrote into facts.md (never the quoted citizen text). */
export function parsePhotoMeta(facts: string | null): PhotoMeta {
  const meta = (facts ?? "").split("## What the citizen wrote")[0];
  const taken = /^Photo taken:\s*(.+)$/m.exec(meta)?.[1]?.trim() ?? null;
  const gps = /^Photo GPS:\s*(.+)$/m.exec(meta)?.[1]?.trim() ?? null;
  return { taken, gps };
}

export function formatTaken(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toISOString().slice(0, 10);
}

export function mapsUrl(gps: string): string | null {
  const match = /^(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(gps);
  return match ? `https://www.google.com/maps?q=${match[1]},${match[2]}` : null;
}

export const LANGUAGES = [
  { code: "en", label: "English", speech: "en-IN" },
  { code: "hi", label: "हिन्दी", speech: "hi-IN" },
  { code: "as", label: "অসমীয়া", speech: "as-IN" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export function speechLang(code: string): string {
  return LANGUAGES.find((language) => language.code === code)?.speech ?? "en-IN";
}

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Client-side photo check (the server checks again by looking at the bytes). Returns an error message or null. */
export function photoProblem(file: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES.includes(file.type)) return "Please choose a JPEG, PNG or WebP photo.";
  if (file.size > MAX_PHOTO_BYTES) return "That photo is larger than 5 MB. Please choose a smaller one.";
  return null;
}

export const EXAMPLES = [
  {
    label: "Pothole in my Guwahati lane for 3 months",
    language: "as" as const,
    place: "Guwahati",
    text: "আমাৰ গুৱাহাটীৰ লেনটোত তিনিমাহ ধৰি এটা ডাঙৰ গাঁত হৈ আছে। দুজন মানুহ পৰি আঘাত পাইছে। অনুগ্ৰহ কৰি ৰাস্তাটো মেৰামতি কৰক।",
  },
  {
    label: "My Speed Post parcel is lost",
    language: "en" as const,
    place: "",
    text: "My Speed Post parcel sent from Guwahati two weeks ago has not reached the address and the tracking has not updated. I want to know where it is.",
  },
];
