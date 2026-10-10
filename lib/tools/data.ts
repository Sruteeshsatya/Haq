import authoritiesJson from "../../data/authorities.json";
import lawsJson from "../../data/laws.json";

export interface IssueEntry {
  office: string;
  grievance: string;
  rti: string;
  rti_pio: string;
  verified: boolean;
  verify_note?: string;
}

export interface CityData {
  name: string;
  state: string;
  match_places: string[];
  issues: Record<string, IssueEntry>;
  sources: string[];
}

export interface StateData {
  name: string;
  default_grievance: string;
  default_rti: string;
  assam_places: string[];
  issues: Record<string, IssueEntry>;
  sources: string[];
}

export interface CentralData {
  name: string;
  default_grievance: string;
  default_rti: string;
  issues: Record<string, IssueEntry>;
  sources: string[];
}

export interface AuthoritiesData {
  levels: {
    city: Record<string, CityData>;
    state: Record<string, StateData>;
    central: CentralData;
  };
  issue_keywords: Record<string, string[]>;
}

export type LawEntry = Record<string, unknown>;

export const authorities = authoritiesJson as unknown as AuthoritiesData;

const laws = lawsJson as unknown as Record<string, unknown>;

export const ISSUE_TYPES = Object.keys(authorities.issue_keywords) as [string, ...string[]];

export const LAW_KEYS = Object.keys(laws).filter((key) => key !== "_note") as [string, ...string[]];

/** Returns the laws.json entry for a key, or undefined. "_note" is never a law. */
export function getLaw(key: string | null | undefined): LawEntry | undefined {
  if (!key || key === "_note" || !Object.hasOwn(laws, key)) return undefined;
  const value = laws[key];
  return typeof value === "object" && value !== null ? (value as LawEntry) : undefined;
}

/** Returns the nested "rules" object of a law entry (e.g. rti_act_2005.rules), or undefined. */
export function getLawRules(law: LawEntry | undefined): LawEntry | undefined {
  const rules = law?.rules;
  return typeof rules === "object" && rules !== null ? (rules as LawEntry) : undefined;
}

/** Reads a numeric field from a law entry. */
export function lawNumber(law: LawEntry | undefined, field: string): number | undefined {
  const value = law?.[field];
  return typeof value === "number" ? value : undefined;
}

/** Reads a string field from a law entry. */
export function lawString(law: LawEntry | undefined, field: string): string | undefined {
  const value = law?.[field];
  return typeof value === "string" ? value : undefined;
}
