import { checkFullHall } from "../domain/booking.js";
import { fullHallPrice } from "../domain/pricing.js";
import { buildSeatPlan, type ISeatPlan } from "../domain/seatPlan.js";
import { prisma } from "../db.js";
import { notFound } from "../errors.js";
import { toPrices } from "./mappers.js";

/**
 * The seat plan page for one showing.
 */
export interface IShowtimeSeatPlan {
  showtime: {
    id: number;
    startsAt: Date;
    endsAt: Date;
    status: "scheduled" | "cancelled";
    movie: { id: number; title: string; durationMin: number; ageRating: string };
    hall: { id: number; name: string };
  };
  plan: ISeatPlan;
}

/**
 * Loads the seat plan for a showing: every seat with its price and whether it's
 * free, plus whether the whole hall can be booked.
 *
 * @param showtimeId - The showing.
 * @param now - Current time.
 * @returns The showing and its seat plan.
 * @throws AppError 404 if the showing doesn't exist.
 */
export async function getSeatPlan(showtimeId: number, now: Date = new Date()): Promise<IShowtimeSeatPlan> {
  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
    include: { movie: true, hall: { include: { seats: true } }, bookingSeats: { select: { seatId: true } } },
  });
  if (!showtime) throw notFound("Showing");

  const confirmed = await prisma.booking.count({ where: { showtimeId, status: "confirmed" } });
  const prices = toPrices(showtime);
  const activeTypes = showtime.hall.seats.filter((s) => s.isActive).map((s) => s.type);
  const fullHall =
    showtime.status === "cancelled"
      ? { eligible: false, blockedBy: "cancelled" as const, reason: "This showing has been cancelled." }
      : checkFullHall(showtime.startsAt, now, confirmed);

  return {
    showtime: {
      id: showtime.id,
      startsAt: showtime.startsAt,
      endsAt: showtime.endsAt,
      status: showtime.status,
      movie: {
        id: showtime.movie.id,
        title: showtime.movie.title,
        durationMin: showtime.movie.durationMin,
        ageRating: showtime.movie.ageRating,
      },
      hall: { id: showtime.hall.id, name: showtime.hall.name },
    },
    plan: buildSeatPlan({
      layoutRows: showtime.hall.layoutRows,
      layoutCols: showtime.hall.layoutCols,
      seats: showtime.hall.seats,
      takenSeatIds: new Set(showtime.bookingSeats.map((b) => b.seatId)),
      prices,
      fullHall: { ...fullHall, price: fullHallPrice(activeTypes, prices) },
    }),
  };
}
