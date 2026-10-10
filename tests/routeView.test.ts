import { describe, expect, it } from "vitest";
import { buildRouteView, buildSources } from "../lib/server/routeView";
import { findAuthority } from "../lib/tools/findAuthority";

const wrap = (result: unknown) => ({ issueType: "x", place: "y", result });

describe("route view for the badge", () => {
  it("city route", () => {
    const view = buildRouteView(wrap(findAuthority("road_pothole", "Guwahati")));
    expect(view).toMatchObject({ covered: true, level: "city", verified: true, verifyNote: null });
    expect(view?.office).toContain("GMC");
  });

  it("an unverified office carries its verify note", () => {
    const view = buildRouteView(wrap(findAuthority("electricity", "Jorhat")));
    expect(view).toMatchObject({ level: "state", verified: false });
    expect(view?.verifyNote).toContain("APDCL");
  });

  it("empty place keeps the 'assumed Assam' note", () => {
    const view = buildRouteView(wrap(findAuthority("electricity", "")));
    expect(view?.verified).toBe(false);
    expect(view?.verifyNote).toContain("Place not given; assumed Assam.");
  });

  it("an uncovered issue shows the general route and the state-not-covered note, never as verified", () => {
    const view = buildRouteView(wrap(findAuthority("road_pothole", "Mumbai")));
    expect(view).toMatchObject({ covered: false, level: "central", verified: false });
    expect(view?.note).toContain("Your state is not covered yet.");
  });

  it("returns null for missing or broken routing.json", () => {
    for (const bad of [null, undefined, {}, { result: null }, { result: { covered: true } }, "x"]) {
      expect(buildRouteView(bad)).toBeNull();
    }
  });
});

describe("sources for Where to file", () => {
  it("collects the authority, grievance, RTI and RTI Act sources without duplicates", () => {
    const sources = buildSources(wrap(findAuthority("road_pothole", "Guwahati")));
    const urls = sources.map((s) => s.url);
    expect(urls).toContain("https://gmc.assam.gov.in/resource/grievance-redressal");
    expect(urls).toContain("https://rtionline.assam.gov.in/guidelines.php");
    expect(urls).toContain("https://rtionline.assam.gov.in");
    expect(urls).toContain("https://rti.gov.in/rti-act.pdf");
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((u) => /^https?:\/\//.test(u))).toBe(true);
  });

  it("central routes list CPGRAMS and the central RTI portal", () => {
    const urls = buildSources(wrap(findAuthority("passport", "Mumbai"))).map((s) => s.url);
    expect(urls).toContain("https://pgportal.gov.in");
    expect(urls).toContain("https://rtionline.gov.in");
  });

  it("falls back to just the RTI Act for broken input, and never throws", () => {
    for (const bad of [null, undefined, {}, { result: {} }, { result: { sources: "x" } }]) {
      expect(buildSources(bad).map((s) => s.url)).toEqual(["https://rti.gov.in/rti-act.pdf"]);
    }
  });
});
