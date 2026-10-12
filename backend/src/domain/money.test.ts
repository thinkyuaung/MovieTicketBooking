import { describe, expect, it } from "vitest";
import { formatMMK } from "./money.js";

describe("formatMMK", () => {
  it("adds thousands separators and the currency", () => {
    expect(formatMMK(15000)).toBe("15,000 MMK");
    expect(formatMMK(4560000)).toBe("4,560,000 MMK");
    expect(formatMMK(0)).toBe("0 MMK");
  });
});
