import { describe, expect, it } from "vitest";
import { checkDraft, unknownSections, type DraftKind } from "../lib/tools/checkDraft";

const GOOD_RTI = `To,
The Public Information Officer,
Guwahati Municipal Corporation, Panbazar, Guwahati - 781001

Subject: Information under Section 6(1) of the RTI Act, 2005 about the road at Lane 3, Chandmari

Sir/Madam,
Under Section 6(1) of the Right to Information Act, 2005, I request the following information for the period from 1 January 2025 to date:
1. Certified copies of work orders issued for repair of the road at Lane 3, Chandmari.
2. Budget sanctioned and amount spent on its maintenance.
3. Copies of inspection reports and file notings about the potholes on this road.

I am enclosing the application fee of Rs. 10 by Indian Postal Order.

Yours faithfully,
[Your name]
[Your address]`;

const GOOD_COMPLAINT = `To,
The Public Grievance Officer,
Guwahati Municipal Corporation, Panbazar, Guwahati - 781001

Subject: Large pothole on Lane 3, Chandmari, Guwahati

Sir/Madam,
There has been a large pothole on Lane 3, Chandmari, Guwahati for the last 3 months, since July 2026. Two people have fallen and been injured. A photo is attached as Annexure 1.

I request you to kindly get the pothole repaired within 21 days and inform me of the action taken.

Yours faithfully,
[Your name]
[Your phone]`;

const GOOD_APPEAL = `To,
The First Appellate Authority,
Guwahati Municipal Corporation, Panbazar, Guwahati - 781001

Subject: First appeal under Section 19(1) of the RTI Act, 2005

Sir/Madam,
I filed an RTI application dated 05 January 2026 (registration no. GMC/R/2026/00123) with the Public Information Officer. No reply was received within 30 days. I request you to direct the PIO to provide the information.

[Your name]
[Your address]`;

function failedIds(kind: DraftKind, text: string, options?: { hasEvidence?: boolean }): string[] {
  return checkDraft(kind, text, options)
    .checks.filter((check) => !check.passed)
    .map((check) => check.id);
}

function repeatWords(count: number): string {
  return Array.from({ length: count }, (_, i) => `word${i}`).join(" ");
}

describe("checkDraft: rti", () => {
  it("passes a good RTI draft", () => {
    const result = checkDraft("rti", GOOD_RTI);
    expect(result.checks.filter((c) => !c.passed)).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.checks.every((c) => c.id && c.label && c.hint)).toBe(true);
  });

  it("fails when over 500 words", () => {
    expect(failedIds("rti", `${GOOD_RTI}\n${repeatWords(500)}`)).toContain("rti_word_count");
  });

  it("fails when not addressed to the PIO", () => {
    expect(failedIds("rti", GOOD_RTI.replace("Public Information Officer", "Commissioner"))).toEqual([
      "rti_addressed_pio",
    ]);
  });

  it("fails without Section 6(1)", () => {
    expect(failedIds("rti", GOOD_RTI.replaceAll("Section 6(1)", "the RTI Act"))).toEqual([
      "rti_section_6_1",
    ]);
  });

  it("accepts the fee as ₹10, Rs 10, Rs. 10 or BPL, but not Rs. 100", () => {
    const noFee = GOOD_RTI.replace("Rs. 10", "the fee");
    expect(failedIds("rti", noFee)).toEqual(["rti_fee"]);
    for (const fee of ["₹10", "Rs 10", "Rs. 10", "I am a BPL card holder"]) {
      expect(failedIds("rti", noFee.replace("the fee", fee)), fee).toEqual([]);
    }
    expect(failedIds("rti", noFee.replace("the fee", "Rs. 100"))).toEqual(["rti_fee"]);
  });

  it("fails with fewer than 3 numbered requests", () => {
    const two = GOOD_RTI.replace(/^3\. .*$/m, "");
    expect(failedIds("rti", two)).toEqual(["rti_numbered_requests"]);
  });

  it('fails when a request starts with "Why"', () => {
    const why = GOOD_RTI.replace("2. Budget sanctioned", "2. Why was the budget not spent; budget sanctioned");
    expect(failedIds("rti", why)).toEqual(["rti_no_why"]);
  });

  it("fails without a time period", () => {
    const text = GOOD_RTI.replace("for the period from 1 January 2025 to date", "");
    expect(failedIds("rti", text)).toContain("rti_time_period");
    expect(failedIds("rti", text.replace("Subject:", "Subject: (2025)"))).not.toContain(
      "rti_time_period",
    );
  });

  it("fails without the name and address placeholders", () => {
    expect(failedIds("rti", GOOD_RTI.replace("[Your name]", "Ravi"))).toEqual(["rti_placeholders"]);
    expect(failedIds("rti", GOOD_RTI.replace("[Your address]", "Dispur"))).toEqual([
      "rti_placeholders",
    ]);
  });

  it("an empty draft fails", () => {
    expect(checkDraft("rti", "").passed).toBe(false);
  });
});

describe("checkDraft: complaint", () => {
  it("passes a good complaint (with evidence)", () => {
    const result = checkDraft("complaint", GOOD_COMPLAINT, { hasEvidence: true });
    expect(result.checks.filter((c) => !c.passed)).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("fails without a Subject line", () => {
    expect(failedIds("complaint", GOOD_COMPLAINT.replace("Subject:", "Re:"))).toEqual([
      "complaint_subject",
    ]);
  });

  it("fails without a location", () => {
    const text = `Subject: Problem\n\nThis has been bad since July 2026. I request you to fix it. A photo is attached.\n[Your name]\n[Your phone]\n[Your address]`;
    expect(failedIds("complaint", text)).toEqual(["complaint_location"]);
  });

  it("does not accept the [Your address] placeholder as a location", () => {
    const text = `Subject: Problem\n\nIt is bad since July 2026. Kindly fix it.\n[Your name]\n[Your phone]\n[Your address]`;
    expect(failedIds("complaint", text)).toContain("complaint_location");
  });

  it("fails without since-when information", () => {
    const text = GOOD_COMPLAINT.replace("for the last 3 months, since July 2026", "currently");
    expect(failedIds("complaint", text)).toEqual(["complaint_since_when"]);
  });

  it("accepts a duration, a month, or a date as since-when", () => {
    const base = GOOD_COMPLAINT.replace("for the last 3 months, since July 2026", "XX");
    for (const phrase of ["for 3 months", "in July", "on 12/07/2026", "since last year"]) {
      expect(failedIds("complaint", base.replace("XX", phrase)), phrase).toEqual([]);
    }
  });

  it("fails without a specific request", () => {
    const text = GOOD_COMPLAINT.replace(
      "I request you to kindly get the pothole repaired within 21 days and inform me of the action taken.",
      "It is dangerous.",
    );
    expect(failedIds("complaint", text)).toEqual(["complaint_request"]);
  });

  it("checks the annexure only when evidence exists (default: no evidence)", () => {
    const noAnnexure = GOOD_COMPLAINT.replace(" A photo is attached as Annexure 1.", "");
    expect(failedIds("complaint", noAnnexure)).toEqual([]);
    expect(failedIds("complaint", noAnnexure, { hasEvidence: false })).toEqual([]);
    expect(failedIds("complaint", noAnnexure, { hasEvidence: true })).toEqual([
      "complaint_annexure",
    ]);
    expect(failedIds("complaint", GOOD_COMPLAINT, { hasEvidence: true })).toEqual([]);
    const photoOnly = noAnnexure.replace("Two people", "See the photo. Two people");
    expect(failedIds("complaint", photoOnly, { hasEvidence: true })).toEqual([]);
  });

  it("fails without the name and phone placeholders", () => {
    expect(failedIds("complaint", GOOD_COMPLAINT.replace("[Your phone]", "98765"))).toEqual([
      "complaint_placeholders",
    ]);
    expect(failedIds("complaint", GOOD_COMPLAINT.replace("[Your name]", "Ravi"))).toEqual([
      "complaint_placeholders",
    ]);
  });

  it("fails when over 400 words", () => {
    expect(failedIds("complaint", `${GOOD_COMPLAINT}\n${repeatWords(400)}`)).toEqual([
      "complaint_word_count",
    ]);
  });
});

describe("checkDraft: first_appeal", () => {
  it("passes a good first appeal", () => {
    const result = checkDraft("first_appeal", GOOD_APPEAL);
    expect(result.checks.filter((c) => !c.passed)).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("fails without Section 19(1)", () => {
    expect(failedIds("first_appeal", GOOD_APPEAL.replace("Section 19(1)", "the RTI Act"))).toEqual([
      "appeal_section_19_1",
    ]);
  });

  it("fails when not addressed to the First Appellate Authority", () => {
    expect(
      failedIds("first_appeal", GOOD_APPEAL.replace("First Appellate Authority", "Commissioner")),
    ).toEqual(["appeal_addressed_faa"]);
  });

  it("fails without the original RTI date or reference", () => {
    const text = GOOD_APPEAL.replace(
      "dated 05 January 2026 (registration no. GMC/R/2026/00123) ",
      "",
    );
    expect(failedIds("first_appeal", text)).toEqual(["appeal_original_rti"]);
  });

  it("accepts a reference number without a date", () => {
    const text = GOOD_APPEAL.replace("dated 05 January 2026 ", "");
    expect(failedIds("first_appeal", text)).toEqual([]);
  });

  it("does not accept a bare placeholder as the RTI reference", () => {
    const text = GOOD_APPEAL.replace(
      "dated 05 January 2026 (registration no. GMC/R/2026/00123) ",
      "with reference number [RTI number] ",
    );
    expect(failedIds("first_appeal", text)).toEqual(["appeal_original_rti"]);
  });

  it("fails without a ground of appeal", () => {
    const text = GOOD_APPEAL.replace(
      "No reply was received within 30 days. ",
      "",
    );
    expect(failedIds("first_appeal", text)).toEqual(["appeal_ground"]);
  });

  it("accepts an unsatisfactory reply as the ground", () => {
    const text = GOOD_APPEAL.replace(
      "No reply was received within 30 days.",
      "The reply received is unsatisfactory and incomplete.",
    );
    expect(failedIds("first_appeal", text)).toEqual([]);
  });
});

describe("checkDraft: misc", () => {
  it("throws for an unknown kind", () => {
    expect(() => checkDraft("nope" as DraftKind, "text")).toThrow(/Unknown draft kind/);
  });
});

describe("checkDraft: only known legal sections", () => {
  it("finds section numbers other than 6(1) and 19(1)", () => {
    expect(unknownSections("under Section 6(1) and Section 19(1) of the RTI Act")).toEqual([]);
    expect(unknownSections("as per Section 7(1) of the RTI Act")).toEqual(["7(1)"]);
    expect(unknownSections("section 8 and Sec. 20(1) and sections 7(1), u/s 18")).toEqual(["8", "20(1)", "7(1)", "18"]);
    expect(unknownSections("Section 6 ( 1 ) is fine, section 19(1) too")).toEqual([]);
    expect(unknownSections("the intersection 7 of the road, 7 sections of road")).toEqual([]);
  });

  it("fails any draft kind that cites another section, with a hint naming it", () => {
    const appeal = GOOD_APPEAL.replace("No reply was received", "As per Section 7(1) of the RTI Act, no reply was received");
    expect(failedIds("first_appeal", appeal)).toEqual(["cites_only_known_sections"]);
    const hint = checkDraft("first_appeal", appeal).checks.find((c) => c.id === "cites_only_known_sections")?.hint;
    expect(hint).toContain("Section 7(1)");
    expect(failedIds("rti", GOOD_RTI + "\nSee Section 8(1)(j).")).toEqual(["cites_only_known_sections"]);
    expect(failedIds("complaint", GOOD_COMPLAINT + "\nUnder Section 133 of the Code.")).toEqual(["cites_only_known_sections"]);
  });

  it("passes the normal drafts", () => {
    expect(failedIds("rti", GOOD_RTI)).toEqual([]);
    expect(failedIds("first_appeal", GOOD_APPEAL)).toEqual([]);
  });
});