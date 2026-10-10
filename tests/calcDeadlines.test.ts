import { describe, expect, it } from "vitest";
import { calcDeadlines, toIcs } from "../lib/tools/calcDeadlines";

const FILING = "2026-01-05";

function byLabel(events: ReturnType<typeof calcDeadlines>, label: string) {
  const event = events.find((e) => e.label === label);
  if (!event) throw new Error(`Missing event: ${label}`);
  return event;
}

describe("calcDeadlines", () => {
  const gmc = { grievanceKey: "gmc_grievance", rtiKey: "rti_assam" };

  it("measures RTI dates from the filing date (day 0) with the default first appeal on day 30", () => {
    const events = calcDeadlines(gmc, FILING);
    expect(byLabel(events, "RTI reply due").date).toBe("2026-02-04"); // day 30
    expect(byLabel(events, "Last day to file first appeal").date).toBe("2026-03-06"); // day 60
    expect(byLabel(events, "First appeal decision due").date).toBe("2026-03-06"); // day 60
    expect(byLabel(events, "Last day to file second appeal").date).toBe("2026-06-04"); // 60 + 90
  });

  it("computes grievance dates from the grievance law", () => {
    const events = calcDeadlines(gmc, FILING);
    expect(byLabel(events, "Grievance acknowledgement due").date).toBe("2026-01-10");
    expect(byLabel(events, "Grievance redressal due").date).toBe("2026-01-26");
    expect(byLabel(events, "Grievance redressal due").kind).toBe("grievance");
  });

  it("uses kinds grievance / rti / appeal", () => {
    const events = calcDeadlines(gmc, FILING);
    expect(byLabel(events, "RTI reply due").kind).toBe("rti");
    expect(byLabel(events, "First appeal decision due").kind).toBe("appeal");
    expect(new Set(events.map((e) => e.kind))).toEqual(new Set(["grievance", "rti", "appeal"]));
  });

  it("returns events sorted by date with YYYY-MM-DD dates", () => {
    const events = calcDeadlines(gmc, FILING);
    const dates = events.map((e) => e.date);
    expect(dates).toEqual([...dates].sort());
    for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("states the assumptions and the 45-day maximum in the explanations", () => {
    const events = calcDeadlines(gmc, FILING);
    const faa = byLabel(events, "First appeal decision due").explanation;
    expect(faa).toContain("day 0");
    expect(faa).toContain("Assumption: the first appeal is filed on day 30");
    expect(faa).toContain("45 days");
    expect(faa).toContain("2026-03-21"); // day 75
    expect(faa).toContain("day 75");
    const second = byLabel(events, "Last day to file second appeal").explanation;
    expect(second).toContain("Assumption: the first appeal is filed on day 30");
    expect(second).toContain("first appeal decision due date");
    expect(byLabel(events, "RTI reply due").explanation).toContain(FILING);
  });

  it("computes FAA and second-appeal dates from firstAppealDate when given", () => {
    const events = calcDeadlines(gmc, FILING, { firstAppealDate: "2026-02-10" });
    expect(byLabel(events, "RTI reply due").date).toBe("2026-02-04");
    expect(byLabel(events, "Last day to file first appeal").date).toBe("2026-03-06");
    expect(byLabel(events, "First appeal decision due").date).toBe("2026-03-12"); // +30
    expect(byLabel(events, "Last day to file second appeal").date).toBe("2026-06-10"); // +90
    const faa = byLabel(events, "First appeal decision due").explanation;
    expect(faa).toContain("2026-02-10");
    expect(faa).toContain("2026-03-27"); // +45
    expect(faa).not.toContain("Assumption");
  });

  it("works for CPGRAMS and central RTI, and mentions the Poor-rating appeal", () => {
    const events = calcDeadlines({ grievanceKey: "cpgrams", rtiKey: "rti_central" }, FILING);
    const redressal = byLabel(events, "Grievance redressal due");
    expect(redressal.date).toBe("2026-01-26");
    expect(redressal.explanation).toContain("rate it Poor");
    expect(redressal.explanation).toContain("appeal within 30 days");
    expect(events.some((e) => e.label === "Grievance acknowledgement due")).toBe(false);
    expect(byLabel(events, "RTI reply due").date).toBe("2026-02-04");
  });

  it("gives no event for offices without a verified deadline", () => {
    const events = calcDeadlines(
      { grievanceKey: "assam_cm_grievance", rtiKey: "rti_assam" },
      FILING,
    );
    expect(events.some((e) => e.kind === "grievance")).toBe(false);
    expect(events.some((e) => e.kind === "rti")).toBe(true);
    expect(calcDeadlines({ grievanceKey: "assam_cm_grievance" }, FILING)).toEqual([]);
    expect(calcDeadlines({ grievanceKey: "nope", rtiKey: "nope" }, FILING)).toEqual([]);
  });

  it("handles month ends and leap years", () => {
    const events = calcDeadlines({ rtiKey: "rti_central" }, "2028-01-31");
    expect(byLabel(events, "RTI reply due").date).toBe("2028-03-01"); // 2028 is a leap year
  });

  it("rejects invalid dates", () => {
    expect(() => calcDeadlines(gmc, "05-01-2026")).toThrow(/YYYY-MM-DD/);
    expect(() => calcDeadlines(gmc, "2026-02-30")).toThrow(/YYYY-MM-DD/);
    expect(() => calcDeadlines(gmc, FILING, { firstAppealDate: "tomorrow" })).toThrow(
      /firstAppealDate/,
    );
  });

  it("rejects a first appeal date before the filing date", () => {
    expect(() => calcDeadlines(gmc, FILING, { firstAppealDate: "2026-01-01" })).toThrow(
      /before filingDate/,
    );
  });

  it("notes when the first appeal date is after the appeal window", () => {
    const events = calcDeadlines(gmc, FILING, { firstAppealDate: "2026-03-20" });
    expect(byLabel(events, "Last day to file first appeal").explanation).toContain(
      "after the window ended",
    );
  });
});

describe("toIcs", () => {
  it("builds a calendar with one all-day event per deadline", () => {
    const events = calcDeadlines({ grievanceKey: "gmc_grievance", rtiKey: "rti_assam" }, FILING);
    const ics = toIcs(events);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(events.length);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260204");
    expect(ics).toContain("SUMMARY:RTI reply due");
  });

  it("returns a valid empty calendar for no events", () => {
    const ics = toIcs([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
