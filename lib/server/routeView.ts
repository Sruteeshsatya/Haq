import { getLaw } from "../tools/data";

export interface RouteView {
  covered: boolean;
  level: "city" | "state" | "central";
  office: string;
  verified: boolean;
  verifyNote: string | null;
  note: string | null;
  grievanceKey: string | null;
  rtiKey: string | null;
  rtiPio: string | null;
}

export interface SourceLink {
  label: string;
  url: string;
}

type Loose = Record<string, unknown>;

const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);

/**
 * Normalises routing.json (find_authority output) for the UI. A covered result and the
 * generalRoute of an uncovered one look the same to the page. Returns null for anything unusable.
 */
export function buildRouteView(routing: unknown): RouteView | null {
  const result = (routing as { result?: Loose } | null)?.result;
  if (!result || typeof result !== "object") return null;
  const covered = result.covered === true;
  const route = (covered ? result : (result.generalRoute as Loose | undefined)) ?? null;
  if (!route || typeof route !== "object") return null;
  const level = route.level === "city" || route.level === "state" || route.level === "central" ? route.level : null;
  const office = str(route.office);
  if (!level || !office) return null;
  const notes = [str(result.verifyNote), str(result.note)].filter((n): n is string => n !== null);
  return {
    covered,
    level,
    office,
    verified: covered ? route.verified === true : false,
    verifyNote: str(route.verifyNote) ?? (covered ? null : str(result.verifyNote)),
    note: covered ? null : (notes.find((n) => n === str(result.note)) ?? null),
    grievanceKey: str(route.grievanceKey),
    rtiKey: str(route.rtiKey),
    rtiPio: str(route.rtiPio),
  };
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

/**
 * Source URLs for "Where to file": the authority's own sources (from routing.json) plus the
 * sources of the grievance channel, the RTI route and the RTI Act in laws.json. Deduplicated.
 */
export function buildSources(routing: unknown): SourceLink[] {
  const result = (routing as { result?: Loose } | null)?.result;
  const route = (result?.covered === true ? result : (result?.generalRoute as Loose | undefined)) ?? undefined;
  const found: SourceLink[] = [];
  const add = (label: string, url: unknown) => {
    if (isHttpUrl(url) && !found.some((item) => item.url === url)) found.push({ label, url });
  };

  const own = Array.isArray(route?.sources) ? (route.sources as unknown[]) : [];
  for (const url of own) add("Authority information", url);

  const keys = [str(route?.grievanceKey), str(route?.rtiKey), "rti_act_2005"];
  for (const key of keys) {
    const law = getLaw(key);
    if (!law) continue;
    const label = str(law.name) ?? key ?? "Law";
    const sources = Array.isArray(law.sources) ? (law.sources as unknown[]) : [];
    for (const url of sources) add(label, url);
    add(`${label} (portal)`, law.portal);
  }
  return found;
}
