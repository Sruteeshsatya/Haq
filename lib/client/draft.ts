export interface Details {
  name: string;
  address: string;
  phone: string;
  date: string;
}

export const EMPTY_DETAILS: Details = { name: "", address: "", phone: "", date: "" };

export const DETAILS_KEY = "haq.details.v1";

const PLACEHOLDERS: Array<[RegExp, keyof Details]> = [
  [/\[Your name\]/gi, "name"],
  [/\[Your address\]/gi, "address"],
  [/\[Your phone\]/gi, "phone"],
  [/\[Date\]/gi, "date"],
];

/** Replaces placeholders with what the citizen typed. Empty fields keep their placeholder. Runs in the browser only. */
export function fillPlaceholders(text: string, details: Details): string {
  let out = text;
  for (const [pattern, key] of PLACEHOLDERS) {
    const value = details[key].trim();
    // function replacer: "$&" and similar in a typed value must stay literal
    if (value) out = out.replace(pattern, () => value);
  }
  return out;
}

const PLACEHOLDER_NAMES = ["Your name", "Your address", "Your phone", "Date"];

/** Placeholders still present in the text (for a "fill these in" hint), e.g. ["Your name", "Date"]. */
export function missingPlaceholders(text: string): string[] {
  const lower = text.toLowerCase();
  return PLACEHOLDER_NAMES.filter((name) => lower.includes(`[${name.toLowerCase()}]`));
}

/** Markdown to plain text for Copy / Download .txt: drops formatting marks but keeps the words and line breaks. */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/`([^`]*)`/g, "$1")
    // [ \t] not \s: \s would also swallow the blank line before a list
    .replace(/^[ \t]*[-*+][ \t]+/gm, "- ")
    .replace(/^>\s?/gm, "")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1 ($2)")
    .trim();
}

export function loadDetails(storage: Pick<Storage, "getItem">): Details {
  try {
    const raw = storage.getItem(DETAILS_KEY);
    if (!raw) return EMPTY_DETAILS;
    const parsed = JSON.parse(raw) as Partial<Details>;
    return {
      name: typeof parsed.name === "string" ? parsed.name : "",
      address: typeof parsed.address === "string" ? parsed.address : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      date: typeof parsed.date === "string" ? parsed.date : "",
    };
  } catch {
    return EMPTY_DETAILS;
  }
}

export function saveDetails(storage: Pick<Storage, "setItem">, details: Details): void {
  try {
    storage.setItem(DETAILS_KEY, JSON.stringify(details));
  } catch {
    // storage can be full or blocked (private mode): the form still works for this visit
  }
}
