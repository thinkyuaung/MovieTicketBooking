import { describe, expect, it } from "vitest";
import { generateBookingCode } from "./bookingCode.js";

describe("generateBookingCode", () => {
  it("uses the MT- prefix and unambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(generateBookingCode()).toMatch(/^MT-[2-9A-HJKMNP-Z]{6}$/);
  });
});
