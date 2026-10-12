import type { Hall, Showtime } from "@prisma/client";
import type { ISeatPrices, IShowtimeSummary } from "../domain/cinema.js";
import { prisma } from "../db.js";

/**
 * Loads seat counts, revenue and bookings for a list of showings with a few
 * grouped queries (not one query per showing).
 *
 * @param showtimes - Showtimes loaded with their hall.
 * @returns One summary per showtime, in the same order.
 */
export async function summarizeShowtimes(showtimes: (Showtime & { hall: Hall })[]): Promise<IShowtimeSummary[]> {
  if (showtimes.length === 0) return [];
  const ids = showtimes.map((s) => s.id);
  const hallIds = [...new Set(showtimes.map((s) => s.hallId))];

  const [seatCounts, booked, bookings, fullHall] = await Promise.all([
    prisma.seat.groupBy({ by: ["hallId", "type"], where: { hallId: { in: hallIds }, isActive: true }, _count: { _all: true } }),
    prisma.bookingSeat.groupBy({ by: ["showtimeId"], where: { showtimeId: { in: ids } }, _count: { _all: true } }),
    prisma.booking.groupBy({
      by: ["showtimeId"],
      where: { showtimeId: { in: ids }, status: "confirmed" },
      _sum: { totalPrice: true },
      _count: { _all: true },
    }),
    prisma.booking.findMany({
      where: { showtimeId: { in: ids }, status: "confirmed", isFullHall: true },
      select: { showtimeId: true },
    }),
  ]);

  const bookedBy = new Map(booked.map((b) => [b.showtimeId, b._count._all]));
  const moneyBy = new Map(bookings.map((b) => [b.showtimeId, b]));
  const fullHallIds = new Set(fullHall.map((b) => b.showtimeId));

  return showtimes.map((s) => {
    const hallSeats = seatCounts.filter((c) => c.hallId === s.hallId);
    const has = (type: string) => hallSeats.some((c) => c.type === type && c._count._all > 0);
    const prices: ISeatPrices = {};
    if (has("standard") || has("wheelchair")) prices.standard = s.priceStandard;
    if (has("vip")) prices.vip = s.priceVip;
    if (has("couple")) prices.couple = s.priceCouple;

    return {
      id: s.id,
      movieId: s.movieId,
      hallId: s.hallId,
      hallName: s.hall.name,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      status: s.status,
      totalSeats: hallSeats.reduce((sum, c) => sum + c._count._all, 0),
      bookedSeats: bookedBy.get(s.id) ?? 0,
      prices,
      revenue: moneyBy.get(s.id)?._sum.totalPrice ?? 0,
      bookingCount: moneyBy.get(s.id)?._count._all ?? 0,
      hasFullHallBooking: fullHallIds.has(s.id),
    };
  });
}
