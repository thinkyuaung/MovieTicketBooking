import { Prisma } from "@prisma/client";
import type { IAuthUser } from "../auth/token.js";
import { assertShowtimeOpen, canCancel, checkFullHall, selectSeats } from "../domain/booking.js";
import { generateBookingCode } from "../domain/bookingCode.js";
import { fullHallPrice, seatPrice } from "../domain/pricing.js";
import { prisma } from "../db.js";
import { badRequest, conflict, notFound } from "../errors.js";
import { toPrices } from "./mappers.js";

/**
 * A booking as shown to the customer (and to admins).
 */
export interface IBookingView {
  id: number;
  bookingCode: string;
  status: "confirmed" | "cancelled";
  isFullHall: boolean;
  /** Amount charged, in MMK. */
  totalPrice: number;
  createdAt: Date;
  cancelledAt: Date | null;
  canCancel: boolean;
  showtime: {
    id: number;
    startsAt: Date;
    endsAt: Date;
    status: "scheduled" | "cancelled";
    movieId: number;
    movieTitle: string;
    hallName: string;
  };
  seatCount: number;
  seats: { label: string; type: string; price: number }[];
}

/**
 * Settings for booking transactions. READ COMMITTED makes every read after the
 * showtime row lock see bookings committed by whoever held the lock before.
 */
const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 5_000,
  timeout: 10_000,
};

const bookingInclude = {
  showtime: { include: { movie: true, hall: true } },
  seats: { include: { seat: true } },
} as const;

type BookingWithDetails = Prisma.BookingGetPayload<{ include: typeof bookingInclude }>;

/**
 * Converts a booking loaded with {@link bookingInclude} to its view.
 *
 * @param b - The booking.
 * @param now - Current time, for `canCancel`.
 * @returns The booking view.
 */
function toBookingView(b: BookingWithDetails, now: Date): IBookingView {
  const seats = [...b.seats]
    .sort((x, y) => x.seat.gridRow - y.seat.gridRow || x.seat.gridCol - y.seat.gridCol)
    .map((s) => ({ label: s.seat.label, type: s.seat.type, price: s.price }));
  return {
    id: b.id,
    bookingCode: b.bookingCode,
    status: b.status,
    isFullHall: b.isFullHall,
    totalPrice: b.totalPrice,
    createdAt: b.createdAt,
    cancelledAt: b.cancelledAt,
    canCancel: b.status === "confirmed" && canCancel(b.showtime.startsAt, now),
    showtime: {
      id: b.showtime.id,
      startsAt: b.showtime.startsAt,
      endsAt: b.showtime.endsAt,
      status: b.showtime.status,
      movieId: b.showtime.movieId,
      movieTitle: b.showtime.movie.title,
      hallName: b.showtime.hall.name,
    },
    seatCount: seats.length,
    seats,
  };
}

/**
 * Locks a showing's row until the transaction ends, so only one booking for
 * that showing is processed at a time, then loads it with its hall's seats.
 *
 * @param tx - The open transaction.
 * @param showtimeId - The showing.
 * @returns The showing with its hall and seats.
 * @throws AppError 404 if the showing doesn't exist.
 */
async function lockShowtime(tx: Prisma.TransactionClient, showtimeId: number) {
  await tx.$queryRaw`SELECT id FROM showtimes WHERE id = ${showtimeId} FOR UPDATE`;
  const showtime = await tx.showtime.findUnique({
    where: { id: showtimeId },
    include: { hall: { include: { seats: true } } },
  });
  if (!showtime) throw notFound("Showing");
  return showtime;
}

/**
 * Returns true if the error is a unique-key clash on booked seats.
 *
 * @param err - Any error.
 * @returns Whether two bookings tried to take the same seat.
 */
function isSeatClash(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

/**
 * Books specific seats for a showing.
 *
 * @param userId - Who is booking.
 * @param showtimeId - The showing.
 * @param labels - Seat labels, e.g. ["E7", "E8"].
 * @param now - Current time.
 * @returns The new booking.
 * @throws AppError 400 for an invalid selection or closed showing, 404 if the showing doesn't exist, 409 if a seat is taken.
 */
export async function bookSeats(userId: number, showtimeId: number, labels: string[], now: Date = new Date()): Promise<IBookingView> {
  try {
    const bookingId = await prisma.$transaction(async (tx) => {
      const showtime = await lockShowtime(tx, showtimeId);
      assertShowtimeOpen(showtime, now);

      const taken = await tx.bookingSeat.findMany({ where: { showtimeId }, select: { seatId: true } });
      const seats = selectSeats(labels, showtime.hall.seats, new Set(taken.map((t) => t.seatId)));
      const prices = toPrices(showtime);
      const lines = seats.map((s) => ({ seatId: s.id, showtimeId, price: seatPrice(s.type, prices) }));

      const booking = await tx.booking.create({
        data: {
          bookingCode: generateBookingCode(),
          userId,
          showtimeId,
          totalPrice: lines.reduce((sum, l) => sum + l.price, 0),
          seats: { create: lines },
        },
      });
      return booking.id;
    }, TX_OPTIONS);
    return await getBookingById(bookingId, now);
  } catch (err) {
    // Backstop: the row lock should prevent this, but the unique key is the final guard.
    if (isSeatClash(err)) throw conflict("Sorry, one or more of these seats were just taken. Please choose again.");
    throw err;
  }
}

/**
 * Books every seat in the hall for a showing. Allowed only when the show is at
 * least 7 days away and nobody has booked yet. Each seat row stores its normal
 * price; the booking total is the full-hall price.
 *
 * @param userId - Who is booking.
 * @param showtimeId - The showing.
 * @param now - Current time.
 * @returns The new booking.
 * @throws AppError 400 if the show is too soon or closed, 404 if it doesn't exist, 409 if seats are already booked.
 */
export async function bookFullHall(userId: number, showtimeId: number, now: Date = new Date()): Promise<IBookingView> {
  try {
    const bookingId = await prisma.$transaction(async (tx) => {
      const showtime = await lockShowtime(tx, showtimeId);
      assertShowtimeOpen(showtime, now);

      const confirmed = await tx.booking.count({ where: { showtimeId, status: "confirmed" } });
      const check = checkFullHall(showtime.startsAt, now, confirmed);
      if (!check.eligible) throw check.blockedBy === "already_booked" ? conflict(check.reason!) : badRequest(check.reason!);

      const seats = showtime.hall.seats.filter((s) => s.isActive);
      if (seats.length === 0) throw badRequest("This hall has no seats available.");
      const prices = toPrices(showtime);

      const booking = await tx.booking.create({
        data: {
          bookingCode: generateBookingCode(),
          userId,
          showtimeId,
          totalPrice: fullHallPrice(seats.map((s) => s.type), prices),
          isFullHall: true,
          seats: { create: seats.map((s) => ({ seatId: s.id, showtimeId, price: seatPrice(s.type, prices) })) },
        },
      });
      return booking.id;
    }, TX_OPTIONS);
    return await getBookingById(bookingId, now);
  } catch (err) {
    if (isSeatClash(err)) throw conflict("Full-hall booking is only available when no seats are booked.");
    throw err;
  }
}

/**
 * Cancels a booking and frees its seats. Customers can cancel their own
 * bookings; admins can cancel any. Only allowed before the show starts.
 *
 * @param user - Who is cancelling.
 * @param bookingId - The booking.
 * @param now - Current time.
 * @returns The cancelled booking.
 * @throws AppError 404 if not found (or not theirs), 409 if already cancelled, 400 if the show has started.
 */
export async function cancelBooking(user: IAuthUser, bookingId: number, now: Date = new Date()): Promise<IBookingView> {
  await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: { showtime: true } });
    if (!booking || (booking.userId !== user.id && user.role !== "admin")) throw notFound("Booking");
    if (booking.status === "cancelled") throw conflict("This booking is already cancelled.");
    if (!canCancel(booking.showtime.startsAt, now)) throw badRequest("Bookings can't be cancelled after the show has started.");

    await tx.booking.update({ where: { id: bookingId }, data: { status: "cancelled", cancelledAt: now } });
    await tx.bookingSeat.updateMany({ where: { bookingId }, data: { showtimeId: null } });
  }, TX_OPTIONS);
  return getBookingById(bookingId, now);
}

/**
 * Loads one booking by id, without an ownership check.
 *
 * @param id - The booking id.
 * @param now - Current time.
 * @returns The booking view.
 * @throws AppError 404 if it doesn't exist.
 */
async function getBookingById(id: number, now: Date): Promise<IBookingView> {
  const booking = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking) throw notFound("Booking");
  return toBookingView(booking, now);
}

/**
 * Loads a booking for a user. Customers only see their own; admins see all.
 *
 * @param user - Who is asking.
 * @param id - The booking id.
 * @param now - Current time.
 * @returns The booking view.
 * @throws AppError 404 if not found or not theirs.
 */
export async function getBookingForUser(user: IAuthUser, id: number, now: Date = new Date()): Promise<IBookingView> {
  const booking = await prisma.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking || (booking.userId !== user.id && user.role !== "admin")) throw notFound("Booking");
  return toBookingView(booking, now);
}

/**
 * Lists a user's bookings, newest first.
 *
 * @param userId - The user.
 * @param now - Current time.
 * @returns The user's bookings.
 */
export async function listUserBookings(userId: number, now: Date = new Date()): Promise<IBookingView[]> {
  const bookings = await prisma.booking.findMany({
    where: { userId },
    include: bookingInclude,
    orderBy: { createdAt: "desc" },
  });
  return bookings.map((b) => toBookingView(b, now));
}

/**
 * Lists every booking for a showing, for admins, with who booked.
 *
 * @param showtimeId - The showing.
 * @param now - Current time.
 * @returns Bookings (confirmed first, then newest first) with customer details.
 * @throws AppError 404 if the showing doesn't exist.
 */
export async function listShowtimeBookings(
  showtimeId: number,
  now: Date = new Date(),
): Promise<(IBookingView & { customer: { id: number; name: string; email: string; phone: string | null } })[]> {
  const exists = await prisma.showtime.count({ where: { id: showtimeId } });
  if (!exists) throw notFound("Showing");
  const bookings = await prisma.booking.findMany({
    where: { showtimeId },
    include: { ...bookingInclude, user: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return bookings.map((b) => ({
    ...toBookingView(b, now),
    customer: { id: b.user.id, name: b.user.name, email: b.user.email, phone: b.user.phone },
  }));
}
