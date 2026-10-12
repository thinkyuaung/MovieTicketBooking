import { describe, expect, it } from "vitest";
import { formatMMK } from "./money";

describe("formatMMK", () => {
  it("matches the backend format", () => {
    expect(formatMMK(15000)).toBe("15,000 MMK");
    expect(formatMMK(800000)).toBe("800,000 MMK");
  });
});
