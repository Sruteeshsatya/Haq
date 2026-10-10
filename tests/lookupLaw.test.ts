import { describe, expect, it } from "vitest";
import { lookupLaw } from "../lib/tools/lookupLaw";
import { LAW_KEYS } from "../lib/tools/data";

describe("lookupLaw", () => {
  it("returns the entry for a known key", () => {
    const result = lookupLaw("rti_act_2005");
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.key).toBe("rti_act_2005");
    expect(result.law.name).toBe("Right to Information Act, 2005");
    expect(result.law.sources).toEqual(["https://rti.gov.in/rti-act.pdf"]);
  });

  it("returns portal, fee and sources for a portal key", () => {
    const result = lookupLaw("cpgrams");
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.law.portal).toBe("https://pgportal.gov.in");
    expect(result.law.redressal_days).toBe(21);
  });

  it("returns found:false for an unknown key", () => {
    expect(lookupLaw("made_up_law")).toEqual({ found: false });
    expect(lookupLaw("")).toEqual({ found: false });
  });

  it("does not treat _note or inherited keys as laws", () => {
    expect(lookupLaw("_note")).toEqual({ found: false });
    expect(lookupLaw("toString")).toEqual({ found: false });
  });

  it("every exported law key can be looked up", () => {
    expect(LAW_KEYS).not.toContain("_note");
    for (const key of LAW_KEYS) expect(lookupLaw(key).found).toBe(true);
  });
});
