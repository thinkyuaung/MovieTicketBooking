import { describe, expect, it } from "vitest";
import { computeEndsAt, overlaps } from "./showtime.js";

describe("computeEndsAt", () => {
  it("adds the film length and 15 minutes of cleaning", () => {
    expect(computeEndsAt(new Date("2026-10-20T13:00:00Z"), 148).toISOString()).toBe("2026-10-20T15:43:00.000Z");
  });
});

describe("overlaps", () => {
  const range = (start: string, end: string) => ({ startsAt: new Date(start), endsAt: new Date(end) });

  it("detects overlapping showings", () => {
    expect(overlaps(range("2026-10-20T13:00Z", "2026-10-20T15:00Z"), range("2026-10-20T14:00Z", "2026-10-20T16:00Z"))).toBe(true);
  });

  it("allows back-to-back showings", () => {
    expect(overlaps(range("2026-10-20T13:00Z", "2026-10-20T15:00Z"), range("2026-10-20T15:00Z", "2026-10-20T17:00Z"))).toBe(false);
  });
});
