import { describe, expect, it } from "vitest";
import { isSafetyCase } from "../lib/tools/text";

describe("isSafetyCase", () => {
  it("flags English safety and crime words, case-insensitively", () => {
    expect(isSafetyCase("There is HARASSMENT of girls at Brahmaputra Ghat")).toBe(true);
    expect(isSafetyCase("Eve teasing near the bus stop")).toBe(true);
    expect(isSafetyCase("My phone was stolen")).toBe(true);
    expect(isSafetyCase("Domestic violence at home")).toBe(true);
    expect(isSafetyCase("He gave me a threat")).toBe(true);
  });

  it("flags Hindi words", () => {
    expect(isSafetyCase("महिलाओं के साथ छेड़छाड़ हो रही है")).toBe(true);
    expect(isSafetyCase("घर में चोरी हो गई")).toBe(true);
    expect(isSafetyCase("पुलिस ने मदद नहीं की")).toBe(true);
  });

  it("is false for civic problems", () => {
    expect(isSafetyCase("Big pothole on our lane in Guwahati for 3 months.")).toBe(false);
    expect(isSafetyCase("My Speed Post parcel has not reached the address")).toBe(false);
    expect(isSafetyCase("")).toBe(false);
  });

  it("does not match a word inside a longer word", () => {
    expect(isSafetyCase("The drape is in the garage")).toBe(false);
  });
});
