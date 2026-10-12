import type { SeatType, ShowtimeStatus } from "@prisma/client";
import { badRequest, conflict } from "../errors.js";

/** Most seats one normal booking can hold. Larger groups book the whole hall. */
export const MAX_SEATS_PER_BOOKING = 10;

/** A whole-hall booking must be made at least this many days before the show. */
export const FULL_HALL_MIN_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A seat as needed for booking checks.
 */
export interface IBookableSeat {
  id: number;
  label: string;
  type: SeatType;
  isActive: boolean;
}

/**
 * Whether the whole hall can be booked, and why not if it can't.
 */
export interface IFullHallCheck {
  eligible: boolean;
  /** Which rule failed: the show is too soon, or seats are already booked. */
  blockedBy: "too_soon" | "already_booked" | "cancelled" | null;
  reason: string | null;
}

/**
 * Throws if a showing can no longer be booked (cancelled or already started).
 *
 * @param showtime - The showing's status and start time.
 * @param now - Current time.
 * @throws AppError 400 if the showing is cancelled or has started.
 */
export function assertShowtimeOpen(showtime: { status: ShowtimeStatus; startsAt: Date }, now: Date): void {
  if (showtime.status === "cancelled") throw badRequest("This showing has been cancelled.");
  if (showtime.startsAt.getTime() <= now.getTime()) throw badRequest("This showing has already started.");
}

/**
 * Checks the whole-hall rule: the show is at least 7 days away and nobody has booked yet.
 *
 * @param startsAt - When the show starts.
 * @param now - Current time.
 * @param confirmedBookings - Number of confirmed bookings for the showing.
 * @returns Whether the whole hall can be booked, with a reason if not.
 */
export function checkFullHall(startsAt: Date, now: Date, confirmedBookings: number): IFullHallCheck {
  if (startsAt.getTime() - now.getTime() < FULL_HALL_MIN_DAYS * DAY_MS) {
    return { eligible: false, blockedBy: "too_soon", reason: `Full-hall booking must be made at least ${FULL_HALL_MIN_DAYS} days before the show.` };
  }
  if (confirmedBookings > 0) {
    return { eligible: false, blockedBy: "already_booked", reason: "Full-hall booking is only available when no seats are booked." };
  }
  return { eligible: true, blockedBy: null, reason: null };
}

/**
 * Turns the seat labels a customer picked into seats, checking every booking rule.
 *
 * @param labels - Seat labels from the request, e.g. ["E7", "E8"]. Case and spaces are ignored.
 * @param hallSeats - All seats in the showing's hall.
 * @param takenSeatIds - Seats already booked for this showing.
 * @returns The chosen seats, in the order given.
 * @throws AppError 400 for an empty, too large or invalid selection; 409 if any seat is taken.
 */
export function selectSeats(labels: string[], hallSeats: IBookableSeat[], takenSeatIds: Set<number>): IBookableSeat[] {
  const wanted = [...new Set(labels.map((l) => l.trim().toUpperCase()))];
  if (wanted.length === 0) throw badRequest("Choose at least one seat.");
  if (wanted.length > MAX_SEATS_PER_BOOKING) {
    throw badRequest(`You can book up to ${MAX_SEATS_PER_BOOKING} seats at once. For more, book the whole hall.`);
  }

  const byLabel = new Map(hallSeats.map((s) => [s.label, s]));
  const unknown = wanted.filter((l) => !byLabel.has(l));
  if (unknown.length) throw badRequest(`These seats don't exist in this hall: ${unknown.join(", ")}.`, { seats: unknown });

  const seats = wanted.map((l) => byLabel.get(l)!);
  const inactive = seats.filter((s) => !s.isActive).map((s) => s.label);
  if (inactive.length) throw badRequest(`These seats are out of service: ${inactive.join(", ")}.`, { seats: inactive });

  const taken = seats.filter((s) => takenSeatIds.has(s.id)).map((s) => s.label);
  if (taken.length) throw conflict(`Sorry, these seats were just taken: ${taken.join(", ")}.`, { seats: taken });

  return seats;
}

/**
 * Returns whether a booking can still be cancelled (only before the show starts).
 *
 * @param startsAt - When the show starts.
 * @param now - Current time.
 * @returns True if cancelling is allowed.
 */
export function canCancel(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() > now.getTime();
}
