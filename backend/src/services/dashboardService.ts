import type { Prisma } from "@prisma/client";
import { getAdminDashboard, type IAdminDashboard } from "../domain/cinema.js";
import { prisma } from "../db.js";
import { movieInclude, toMovie, toReview } from "./mappers.js";
import { summarizeShowtimes } from "./showtimeStats.js";

/**
 * Builds the admin dashboard for showings that start within an optional date range.
 * Reviews are not filtered by date.
 *
 * @param range - Optional `from` (inclusive) and `to` (exclusive) start times.
 * @returns The dashboard: totals, per-movie and per-showing figures, low reviews.
 */
export async function getDashboard(range: { from?: Date; to?: Date }): Promise<IAdminDashboard & { range: { from: Date | null; to: Date | null } }> {
  const startsAt: Prisma.DateTimeFilter = {};
  if (range.from) startsAt.gte = range.from;
  if (range.to) startsAt.lt = range.to;

  const [movies, reviews, showtimes] = await Promise.all([
    prisma.movie.findMany({ include: movieInclude }),
    prisma.review.findMany({ include: { user: { select: { name: true } } } }),
    prisma.showtime.findMany({ where: { startsAt }, include: { hall: true } }),
  ]);

  const dashboard = getAdminDashboard(movies.map(toMovie), reviews.map(toReview), await summarizeShowtimes(showtimes));
  return { ...dashboard, range: { from: range.from ?? null, to: range.to ?? null } };
}
