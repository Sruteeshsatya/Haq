import { describe, expect, it } from "vitest";
import {
  findAuthority,
  guessIssueType,
  PLACE_NOT_GIVEN_NOTE,
  STATE_NOT_COVERED_NOTE,
} from "../lib/tools/findAuthority";

describe("findAuthority", () => {
  it("routes a Guwahati pothole to the city (GMC)", () => {
    const result = findAuthority("road_pothole", "Chandmari, Guwahati");
    expect(result.covered).toBe(true);
    if (!result.covered) return;
    expect(result.level).toBe("city");
    expect(result.office).toContain("GMC");
    expect(result.grievanceKey).toBe("gmc_grievance");
    expect(result.rtiKey).toBe("rti_assam");
    expect(result.rtiPio).toContain("Guwahati Municipal Corporation");
    expect(result.verified).toBe(true);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("matches Hindi and Assamese city names", () => {
    for (const place of ["गुवाहाटी", "গুৱাহাটী"]) {
      const result = findAuthority("garbage", place);
      expect(result.covered && result.level).toBe("city");
    }
  });

  it("falls from city to state when the city does not have the issue (Guwahati electricity)", () => {
    const result = findAuthority("electricity", "Guwahati");
    expect(result.covered).toBe(true);
    if (!result.covered) return;
    expect(result.level).toBe("state");
    expect(result.office).toContain("APDCL");
    expect(result.verified).toBe(false);
    expect(result.verifyNote).toContain("APDCL");
  });

  it("routes Jorhat electricity to Assam state", () => {
    const result = findAuthority("electricity", "Jorhat");
    expect(result.covered).toBe(true);
    if (!result.covered) return;
    expect(result.level).toBe("state");
    expect(result.placeStatus).toBe("assam");
    expect(result.grievanceKey).toBe("assam_cm_grievance");
    expect(result.verifyNote).not.toContain(PLACE_NOT_GIVEN_NOTE);
  });

  it("routes a Jorhat pothole to the state PWD (no city data for Jorhat)", () => {
    const result = findAuthority("road_pothole", "Jorhat, Assam");
    expect(result.covered && result.level).toBe("state");
  });

  it("routes a Guwahati post office issue to central", () => {
    const result = findAuthority("post_office", "Guwahati");
    expect(result.covered).toBe(true);
    if (!result.covered) return;
    expect(result.level).toBe("central");
    expect(result.grievanceKey).toBe("cpgrams");
    expect(result.rtiKey).toBe("rti_central");
  });

  it("treats an empty place as Assam and adds a verify note", () => {
    for (const place of [undefined, null, "", "   "]) {
      const result = findAuthority("electricity", place);
      expect(result.covered).toBe(true);
      if (!result.covered) continue;
      expect(result.level).toBe("state");
      expect(result.placeStatus).toBe("empty");
      expect(result.verified).toBe(false);
      expect(result.verifyNote).toContain(PLACE_NOT_GIVEN_NOTE);
    }
    expect(PLACE_NOT_GIVEN_NOTE).toBe("Place not given; assumed Assam.");
  });

  it("does not pick the city when the place is empty", () => {
    const result = findAuthority("road_pothole", "");
    expect(result.covered && result.level).toBe("state");
  });

  it("returns covered:false with the Assam general route for an uncovered issue (Assam place)", () => {
    const result = findAuthority("unknown_issue", "Guwahati");
    expect(result.covered).toBe(false);
    if (result.covered) return;
    expect(result.generalRoute.level).toBe("state");
    expect(result.generalRoute.office).toBe(
      "The Assam Government department that provides the service",
    );
    expect(result.note).toBeUndefined();
  });

  it("returns the state general route with a verify note when the place is empty", () => {
    const result = findAuthority("unknown_issue", "");
    expect(result.covered).toBe(false);
    if (result.covered) return;
    expect(result.generalRoute.level).toBe("state");
    expect(result.verifyNote).toBe(PLACE_NOT_GIVEN_NOTE);
  });

  it("Mumbai pothole -> covered:false with the central general route and the note", () => {
    const result = findAuthority("road_pothole", "Mumbai");
    expect(result.covered).toBe(false);
    if (result.covered) return;
    expect(result.placeStatus).toBe("outside");
    expect(result.generalRoute.level).toBe("central");
    expect(result.generalRoute.grievanceKey).toBe("cpgrams");
    expect(result.generalRoute.office).toContain("central ministry or department");
    expect(result.note).toBe(STATE_NOT_COVERED_NOTE);
    expect(result.note).toContain("Your state is not covered yet.");
  });

  it("Mumbai passport -> central", () => {
    const result = findAuthority("passport", "Mumbai");
    expect(result.covered).toBe(true);
    if (!result.covered) return;
    expect(result.level).toBe("central");
    expect(result.rtiKey).toBe("rti_central");
  });

  it("skips state and city levels for places outside Assam (Mumbai electricity)", () => {
    const result = findAuthority("electricity", "Mumbai");
    expect(result.covered).toBe(false);
  });

  it("does not match a short Assam place name inside another word", () => {
    const result = findAuthority("electricity", "Massamba");
    expect(result.covered).toBe(false);
  });

  it("returns covered:false for an issue type that is not in the data", () => {
    expect(findAuthority("not_an_issue", "Mumbai").covered).toBe(false);
  });

  it("ignores inherited object keys such as 'constructor'", () => {
    expect(findAuthority("constructor", "Guwahati").covered).toBe(false);
  });
});

describe("guessIssueType", () => {
  it("finds English issues, case-insensitively", () => {
    expect(guessIssueType("There is a big POTHOLE near my house")).toBe("road_pothole");
    expect(guessIssueType("The Street Light is broken")).toBe("streetlight");
    expect(guessIssueType("My speed post parcel is lost")).toBe("post_office");
  });

  it("finds Hindi and Assamese words", () => {
    expect(guessIssueType("हमारे मोहल्ले में सड़क पर गड्ढा है")).toBe("road_pothole");
    expect(guessIssueType("कचरा नहीं उठाया गया")).toBe("garbage");
    expect(guessIssueType("আমাৰ লেনত জাবৰ পৰি আছে")).toBe("garbage");
    expect(guessIssueType("ৰাস্তাত গাঁত")).toBe("road_pothole");
  });

  it("prefers the longest matching keyword", () => {
    expect(guessIssueType("speed post parcel")).toBe("post_office");
    expect(guessIssueType("water supply tap")).toBe("water_supply");
  });

  it("does not match keywords inside longer words", () => {
    expect(guessIssueType("it is 5 kilometers away")).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(guessIssueType("hello there")).toBeNull();
    expect(guessIssueType("")).toBeNull();
  });
});
