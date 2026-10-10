import { authorities, type IssueEntry } from "./data";
import { containsTerm } from "./text";

export type AuthorityLevel = "city" | "state" | "central";
export type PlaceStatus = "city" | "assam" | "empty" | "outside";

export interface RouteInfo {
  level: AuthorityLevel;
  office: string;
  grievanceKey: string;
  rtiKey: string;
  rtiPio: string;
  verified: boolean;
  verifyNote?: string;
  sources: string[];
}

export type FindAuthorityResult =
  | ({ covered: true; placeStatus: PlaceStatus } & RouteInfo)
  | {
      covered: false;
      placeStatus: PlaceStatus;
      issueType: string;
      generalRoute: RouteInfo;
      note?: string;
      verifyNote?: string;
    };

export const PLACE_NOT_GIVEN_NOTE = "Place not given; assumed Assam.";

export const STATE_NOT_COVERED_NOTE =
  "Your state is not covered yet. CPGRAMS also accepts state grievances and forwards them to the state government; RTI should go to the relevant state department.";

const assam = authorities.levels.state.assam;
const central = authorities.levels.central;

function toRoute(
  level: AuthorityLevel,
  entry: IssueEntry,
  sources: string[],
  extraNote?: string,
): RouteInfo {
  const notes = [entry.verify_note, extraNote].filter((note): note is string => Boolean(note));
  const route: RouteInfo = {
    level,
    office: entry.office,
    grievanceKey: entry.grievance,
    rtiKey: entry.rti,
    rtiPio: entry.rti_pio,
    verified: extraNote ? false : entry.verified,
    sources: [...sources],
  };
  if (notes.length > 0) route.verifyNote = notes.join(" ");
  return route;
}

function classifyPlace(place: string | null | undefined): {
  status: PlaceStatus;
  cityKey?: string;
} {
  const text = (place ?? "").trim();
  if (!text) return { status: "empty" };
  for (const [cityKey, city] of Object.entries(authorities.levels.city)) {
    if (city.match_places.some((term) => containsTerm(text, term))) {
      return { status: "city", cityKey };
    }
  }
  if (assam.assam_places.some((term) => containsTerm(text, term))) return { status: "assam" };
  return { status: "outside" };
}

/**
 * Routes an issue to the most local level that owns it.
 * - Place matches a city and the city has the issue -> city.
 * - Place empty (assumed Assam), in a city without the issue, or in Assam -> state, then central.
 * - Place given but outside Assam -> central only.
 * - Nothing owns the issue -> covered:false with a general route.
 */
export function findAuthority(
  issueType: string,
  place?: string | null,
): FindAuthorityResult {
  const { status, cityKey } = classifyPlace(place);
  const inAssam = status !== "outside";
  const assumedAssam = status === "empty";

  if (inAssam) {
    if (cityKey) {
      const city = authorities.levels.city[cityKey];
      const entry = Object.hasOwn(city.issues, issueType) ? city.issues[issueType] : undefined;
      if (entry) return { covered: true, placeStatus: status, ...toRoute("city", entry, city.sources) };
    }
    const stateEntry = Object.hasOwn(assam.issues, issueType) ? assam.issues[issueType] : undefined;
    if (stateEntry) {
      return {
        covered: true,
        placeStatus: status,
        ...toRoute("state", stateEntry, assam.sources, assumedAssam ? PLACE_NOT_GIVEN_NOTE : undefined),
      };
    }
  }

  const centralEntry = Object.hasOwn(central.issues, issueType)
    ? central.issues[issueType]
    : undefined;
  if (centralEntry) {
    return { covered: true, placeStatus: status, ...toRoute("central", centralEntry, central.sources) };
  }

  if (inAssam) {
    const result: FindAuthorityResult = {
      covered: false,
      placeStatus: status,
      issueType,
      generalRoute: toRoute(
        "state",
        assam.issues.other_state_service,
        assam.sources,
        assumedAssam ? PLACE_NOT_GIVEN_NOTE : undefined,
      ),
    };
    if (assumedAssam) result.verifyNote = PLACE_NOT_GIVEN_NOTE;
    return result;
  }

  return {
    covered: false,
    placeStatus: status,
    issueType,
    generalRoute: toRoute("central", central.issues.other_central_service, central.sources),
    note: STATE_NOT_COVERED_NOTE,
  };
}

/**
 * Guesses the issue type from free text using issue_keywords.
 * The issue with the longest matching keyword wins; ties go to the first one in the data file.
 * Returns null when nothing matches.
 */
export function guessIssueType(text: string): string | null {
  let best: { issue: string; length: number } | null = null;
  for (const [issue, keywords] of Object.entries(authorities.issue_keywords)) {
    for (const keyword of keywords) {
      if (containsTerm(text, keyword) && (!best || keyword.length > best.length)) {
        best = { issue, length: keyword.length };
      }
    }
  }
  return best ? best.issue : null;
}
