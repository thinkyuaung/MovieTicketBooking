import { describe, expect, it } from "vitest";
import { AppError } from "../errors.js";
import { assertShowtimeOpen, canCancel, checkFullHall, selectSeats, type IBookableSeat } from "./booking.js";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-12T10:00:00Z");

/**
 * Runs a function and returns the AppError it throws.
 *
 * @param fn - Function expected to throw.
 * @returns The thrown AppError.
 */
function caught(fn: () => unknown): AppError {
  try {
    fn();
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err;
  }
  throw new Error("Expected an AppError");
}

describe("checkFullHall", () => {
  it("allows a show exactly 7 days away with no bookings", () => {
    expect(checkFullHall(new Date(now.getTime() + 7 * DAY), now, 0)).toEqual({ eligible: true, blockedBy: null, reason: null });
  });

  it("refuses a show less than 7 days away", () => {
    const check = checkFullHall(new Date(now.getTime() + 7 * DAY - 60_000), now, 0);
    expect(check.eligible).toBe(false);
    expect(check).toMatchObject({ blockedBy: "too_soon" });
    expect(check.reason).toContain("at least 7 days");
  });

  it("refuses when someone has already booked", () => {
    const check = checkFullHall(new Date(now.getTime() + 10 * DAY), now, 1);
    expect(check.eligible).toBe(false);
    expect(check).toMatchObject({ blockedBy: "already_booked" });
    expect(check.reason).toContain("no seats are booked");
  });
});

describe("selectSeats", () => {
  const seats: IBookableSeat[] = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    label: `A${i + 1}`,
    type: "standard",
    isActive: i !== 11, // A12 is out of service
  }));

  it("returns the chosen seats, ignoring case, spaces and duplicates", () => {
    expect(selectSeats([" a1", "A2", "a1"], seats, new Set()).map((s) => s.label)).toEqual(["A1", "A2"]);
  });

  it("rejects more than 10 seats", () => {
    const labels = seats.slice(0, 11).map((s) => s.label);
    expect(caught(() => selectSeats(labels, seats, new Set())).status).toBe(400);
  });

  it("rejects seats that don't exist or are out of service", () => {
    expect(caught(() => selectSeats(["Z9"], seats, new Set())).details).toEqual({ seats: ["Z9"] });
    expect(caught(() => selectSeats(["A12"], seats, new Set())).message).toContain("out of service");
  });

  it("returns 409 with the taken seats", () => {
    const err = caught(() => selectSeats(["A1", "A2", "A3"], seats, new Set([2, 3])));
    expect(err.status).toBe(409);
    expect(err.details).toEqual({ seats: ["A2", "A3"] });
  });
});

describe("assertShowtimeOpen and canCancel", () => {
  it("rejects cancelled and started showings", () => {
    expect(caught(() => assertShowtimeOpen({ status: "cancelled", startsAt: new Date(now.getTime() + DAY) }, now)).status).toBe(400);
    expect(caught(() => assertShowtimeOpen({ status: "scheduled", startsAt: now }, now)).message).toContain("already started");
  });

  it("allows cancelling only before the show", () => {
    expect(canCancel(new Date(now.getTime() + 1000), now)).toBe(true);
    expect(canCancel(now, now)).toBe(false);
  });
});
