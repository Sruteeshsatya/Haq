import { authorities } from "./data";
import { containsTerm, wordCount } from "./text";

export type DraftKind = "complaint" | "rti" | "first_appeal";

export interface DraftCheck {
  id: string;
  label: string;
  passed: boolean;
  hint: string;
}

export interface CheckDraftResult {
  passed: boolean;
  checks: DraftCheck[];
}

export interface CheckDraftOptions {
  /** True when the citizen uploaded evidence (e.g. a photo). Default false. */
  hasEvidence?: boolean;
}

const MONTHS =
  "january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec";
const NUMERIC_DATE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/;
const MONTH_DATE = new RegExp(
  `\\b(?:${MONTHS})\\b\\.?\\s*\\d{0,4}|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?:${MONTHS}|may)\\b|\\bmay\\s+\\d{1,4}\\b`,
  "i",
);
const YEAR = /\b(?:19|20)\d{2}\b/;

const KNOWN_PLACES: string[] = [
  ...Object.values(authorities.levels.city).flatMap((city) => city.match_places),
  ...Object.values(authorities.levels.state).flatMap((state) => state.assam_places),
];
const LOCATION_WORDS =
  /\b(?:ward|road|lane|street|near|locality|colony|sector|chowk|junction|nagar|bypass|pin\s*code)\b|\b\d{6}\b|\blocation\s*:/i;

function numberedItems(text: string): string[] {
  const items: string[] = [];
  const pattern = /^\s*(?:\d+[.)]|\(\d+\))\s*(.*)$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) items.push(match[1].trim());
  return items;
}

function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

function hasPlaceholders(text: string, ...names: string[]): boolean {
  return names.every((name) => text.includes(`[${name}]`));
}

function finish(checks: DraftCheck[]): CheckDraftResult {
  return { passed: checks.every((check) => check.passed), checks };
}

function checkRti(text: string): CheckDraftResult {
  const items = numberedItems(text);
  const limit = 500;
  return finish([
    {
      id: "rti_word_count",
      label: `Within ${limit} words`,
      passed: wordCount(text) <= limit,
      hint: `Shorten the application to ${limit} words or fewer (now ${wordCount(text)}).`,
    },
    {
      id: "rti_addressed_pio",
      label: "Addressed to the Public Information Officer",
      passed: has(text, /public\s+information\s+officer/i),
      hint: 'Address the application to the "Public Information Officer".',
    },
    {
      id: "rti_section_6_1",
      label: "Mentions Section 6(1)",
      passed: has(text, /section\s*6\s*\(\s*1\s*\)/i),
      hint: 'Say the application is made under "Section 6(1)" of the RTI Act, 2005.',
    },
    {
      id: "rti_fee",
      label: "Mentions the fee (Rs. 10) or BPL exemption",
      passed: has(text, /₹\s*10(?!\d)|\brs\.?\s*10(?!\d)|\bbpl\b/i),
      hint: 'Mention the application fee of "Rs. 10" or that the applicant is "BPL".',
    },
    {
      id: "rti_numbered_requests",
      label: "Has 3 or more numbered requests",
      passed: items.length >= 3,
      hint: "List at least 3 requests as numbered points (1. 2. 3.).",
    },
    {
      id: "rti_no_why",
      label: 'No request starts with "Why"',
      passed: !items.some((item) => /^why\b/i.test(item)),
      hint: 'Rewrite "Why..." questions as requests for records (copies of orders, reports, file notings).',
    },
    {
      id: "rti_time_period",
      label: "Mentions a time period",
      // "Act, 2005" is the law's name, not a period for the records.
      passed:
        has(text.replace(/\bAct\s*,?\s*2005\b/gi, ""), YEAR) ||
        has(text, /\bfrom\b[^.\n]{1,80}\bto\b/i),
      hint: 'State the period of the records, e.g. "from January 2025 to date" or a year.',
    },
    {
      id: "rti_placeholders",
      label: "Contains [Your name] and [Your address]",
      passed: hasPlaceholders(text, "Your name", "Your address"),
      hint: "Keep the [Your name] and [Your address] placeholders for the citizen to fill in.",
    },
  ]);
}

function checkComplaint(text: string, hasEvidence: boolean): CheckDraftResult {
  const limit = 400;
  const mentionsPlace = KNOWN_PLACES.some((place) => containsTerm(text, place));
  return finish([
    {
      id: "complaint_subject",
      label: 'Has a "Subject:" line',
      passed: has(text, /subject\s*:/i),
      hint: 'Start with a "Subject:" line that names the problem and place.',
    },
    {
      id: "complaint_location",
      label: "Mentions the location",
      passed: mentionsPlace || has(text, LOCATION_WORDS),
      hint: "Say where the problem is (ward, road, lane, landmark, city or PIN code).",
    },
    {
      id: "complaint_since_when",
      label: "Says since when the problem exists",
      passed:
        has(text, /\bsince\b/i) ||
        has(text, MONTH_DATE) ||
        has(text, NUMERIC_DATE) ||
        has(text, YEAR) ||
        // A duration of the problem ("for 3 months", "2 weeks ago"), not a requested deadline ("within 21 days").
        has(
          text,
          /\b(?:for|over|past|last)\s+(?:the\s+)?(?:(?:last|past|about|around|nearly)\s+)*\d+\s*(?:day|week|month|year)s?\b|\b\d+\s*(?:day|week|month|year)s?\s+(?:ago|now|back)\b/i,
        ),
      hint: 'Say when it started, e.g. "since July 2026" or "for the last 3 months".',
    },
    {
      id: "complaint_request",
      label: "Makes a specific request",
      passed: has(text, /\b(?:request|kindly)\b/i),
      hint: 'State what you want done, using "I request" or "Kindly".',
    },
    {
      id: "complaint_annexure",
      label: "References the annexure or photo as evidence",
      passed: !hasEvidence || has(text, /\b(?:annexure|photo|photograph)s?\b/i),
      hint: 'Evidence was uploaded, so refer to it as "Annexure 1" or "photo".',
    },
    {
      id: "complaint_placeholders",
      label: "Contains [Your name] and [Your phone]",
      passed: hasPlaceholders(text, "Your name", "Your phone"),
      hint: "Keep the [Your name] and [Your phone] placeholders for the citizen to fill in.",
    },
    {
      id: "complaint_word_count",
      label: `Within ${limit} words`,
      passed: wordCount(text) <= limit,
      hint: `Shorten the complaint to ${limit} words or fewer (now ${wordCount(text)}).`,
    },
  ]);
}

function checkFirstAppeal(text: string): CheckDraftResult {
  const referencesRti =
    has(text, NUMERIC_DATE) ||
    has(text, MONTH_DATE) ||
    has(
      text,
      /\b(?:registration|reference|ref\.?|diary)\s*(?:no\.?|number|#)?\s*[:\-]?\s*[A-Za-z0-9/-]*\d[A-Za-z0-9/-]*/i,
    );
  const statesGround =
    has(text, /\b(?:no|not|without)\b[^.\n]{0,60}\b(?:reply|replied|response|received|information)\b/i) ||
    has(text, /\b(?:unsatisfactory|not satisfied|incomplete|misleading|incorrect)\b/i);
  return finish([
    {
      id: "appeal_section_19_1",
      label: "Mentions Section 19(1)",
      passed: has(text, /section\s*19\s*\(\s*1\s*\)/i),
      hint: 'Say the appeal is made under "Section 19(1)" of the RTI Act, 2005.',
    },
    {
      id: "appeal_addressed_faa",
      label: "Addressed to the First Appellate Authority",
      passed: has(text, /first\s+appellate\s+authority/i),
      hint: 'Address the appeal to the "First Appellate Authority".',
    },
    {
      id: "appeal_original_rti",
      label: "Mentions the original RTI date or reference",
      passed: referencesRti,
      hint: "Give the date of the original RTI application or its registration/reference number.",
    },
    {
      id: "appeal_ground",
      label: "States the ground of appeal",
      passed: statesGround,
      hint: 'State the ground, e.g. "no reply was received within 30 days" or "the reply is unsatisfactory".',
    },
  ]);
}

/**
 * Legal provisions a draft may cite. data/laws.json has no section numbers, so the only ones allowed
 * are the two fixed by the caseworker instructions: 6(1) for the RTI application, 19(1) for the first appeal.
 */
const ALLOWED_SECTIONS = new Set(["6(1)", "19(1)"]);

/** Section references in the text that are not allowed, e.g. ["7(1)", "8"]. Exported for tests. */
export function unknownSections(text: string): string[] {
  const found = new Set<string>();
  const pattern = /\b(?:sections?|sec\.|u\/s)\s*(\d+[A-Za-z]?)(?:\s*\(\s*(\w+)\s*\))?/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const ref = match[2] ? `${match[1]}(${match[2]})` : match[1];
    if (!ALLOWED_SECTIONS.has(ref.toLowerCase())) found.add(ref);
  }
  return [...found];
}

function withCitationCheck(result: CheckDraftResult, text: string): CheckDraftResult {
  const unknown = unknownSections(text);
  return finish([
    ...result.checks,
    {
      id: "cites_only_known_sections",
      label: "Cites only Section 6(1) and Section 19(1)",
      passed: unknown.length === 0,
      hint: `Remove the reference to Section ${unknown.join(", Section ")}. Only Section 6(1) (RTI application) and Section 19(1) (first appeal) may be cited; say "the RTI Act, 2005" or "the time allowed by law" instead.`,
    },
  ]);
}

/** Deterministic checks for a draft. Never calls an LLM. */
export function checkDraft(
  kind: DraftKind,
  text: string,
  options: CheckDraftOptions = {},
): CheckDraftResult {
  switch (kind) {
    case "rti":
      return withCitationCheck(checkRti(text), text);
    case "complaint":
      return withCitationCheck(checkComplaint(text, options.hasEvidence ?? false), text);
    case "first_appeal":
      return withCitationCheck(checkFirstAppeal(text), text);
    default:
      throw new Error(`Unknown draft kind: ${String(kind)}`);
  }
}
