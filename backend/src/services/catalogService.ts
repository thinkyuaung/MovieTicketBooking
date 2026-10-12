import { Prisma, type AgeRating, type Seat, type SeatType } from "@prisma/client";
import type { IShowtimeSummary } from "../domain/cinema.js";
import { generateHall, type IHallRowSpec } from "../domain/hallLayout.js";
import type { IMovie } from "../domain/movie.js";
import { computeEndsAt } from "../domain/showtime.js";
import { prisma } from "../db.js";
import { badRequest, conflict, notFound } from "../errors.js";
import { movieInclude, toMovie } from "./mappers.js";
import { summarizeShowtimes } from "./showtimeStats.js";

// ---------------------------------------------------------------- movies

/**
 * Fields an admin sets on a movie.
 */
export interface IMovieInput {
  title: string;
  director: string;
  releaseYear: number;
  durationMin: number;
  ageRating: AgeRating;
  description?: string | null;
  posterUrl?: string | null;
  /** Genre names; new names are created automatically. */
  genres: string[];
}

/**
 * Builds the nested Prisma input that links a movie to genres by name,
 * creating genres that don't exist yet.
 *
 * @param names - Genre names.
 * @returns Nested create input for `movie.genres`.
 */
function genreLinks(names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  return unique.map((name) => ({ genre: { connectOrCreate: { where: { name }, create: { name } } } }));
}

/**
 * Lists all movies with how many showings each has, for the admin.
 *
 * @returns Movies A–Z.
 */
export async function listAdminMovies(): Promise<(IMovie & { showtimeCount: number })[]> {
  const movies = await prisma.movie.findMany({
    include: { ...movieInclude, _count: { select: { showtimes: true } } },
    orderBy: { title: "asc" },
  });
  return movies.map((m) => ({ ...toMovie(m), showtimeCount: m._count.showtimes }));
}

/**
 * Adds a movie.
 *
 * @param input - The movie's details.
 * @returns The new movie.
 */
export async function createMovie(input: IMovieInput): Promise<IMovie> {
  const { genres, ...data } = input;
  const movie = await prisma.movie.create({
    data: { ...data, genres: { create: genreLinks(genres) } },
    include: movieInclude,
  });
  return toMovie(movie);
}

/**
 * Changes a movie. The running time can't change while the movie has upcoming
 * showings, because that would move their end times and could cause overlaps.
 *
 * @param id - The movie id.
 * @param input - Fields to change; `genres` replaces the whole list.
 * @param now - Current time.
 * @returns The updated movie.
 * @throws AppError 404 if not found, 409 if changing the running time of a scheduled movie.
 */
export async function updateMovie(id: number, input: Partial<IMovieInput>, now: Date = new Date()): Promise<IMovie> {
  const existing = await prisma.movie.findUnique({ where: { id } });
  if (!existing) throw notFound("Movie");
  if (input.durationMin !== undefined && input.durationMin !== existing.durationMin) {
    const upcoming = await prisma.showtime.count({ where: { movieId: id, status: "scheduled", startsAt: { gt: now } } });
    if (upcoming) throw conflict("This movie has upcoming showings, so its running time can't be changed.");
  }

  const { genres, ...data } = input;
  const movie = await prisma.$transaction(async (tx) => {
    if (genres) await tx.movieGenre.deleteMany({ where: { movieId: id } });
    return tx.movie.update({
      where: { id },
      data: { ...data, ...(genres && { genres: { create: genreLinks(genres) } }) },
      include: movieInclude,
    });
  });
  return toMovie(movie);
}

/**
 * Deletes a movie that has no showings.
 *
 * @param id - The movie id.
 * @throws AppError 404 if not found, 409 if it has showings.
 */
export async function deleteMovie(id: number): Promise<void> {
  const movie = await prisma.movie.findUnique({ where: { id }, include: { _count: { select: { showtimes: true } } } });
  if (!movie) throw notFound("Movie");
  if (movie._count.showtimes) throw conflict("This movie has showings. Delete or cancel them first.");
  await prisma.movie.delete({ where: { id } });
}

// ---------------------------------------------------------------- halls

/**
 * A hall in the admin list.
 */
export interface IHallListItem {
  id: number;
  name: string;
  layoutRows: number;
  layoutCols: number;
  seatCount: number;
  activeSeatCount: number;
  showtimeCount: number;
}

/**
 * A hall with every seat, for the layout editor.
 */
export interface IHallDetail extends IHallListItem {
  seats: Omit<Seat, "hallId">[];
}

/**
 * Turns a row description into hall data, converting layout errors into 400s.
 *
 * @param name - Hall name.
 * @param rows - Row descriptions, front row first.
 * @returns The generated hall.
 * @throws AppError 400 if the layout is invalid or too large.
 */
function buildHall(name: string, rows: IHallRowSpec[]) {
  try {
    const hall = generateHall({ name, rows });
    if (hall.layoutCols > 255 || hall.layoutRows > 255) throw new Error("The hall layout is too large.");
    return hall;
  } catch (err) {
    throw badRequest(err instanceof Error ? err.message : "Invalid hall layout.");
  }
}

/**
 * Lists halls with seat and showing counts.
 *
 * @returns Halls A–Z.
 */
export async function listHalls(): Promise<IHallListItem[]> {
  const halls = await prisma.hall.findMany({
    include: { seats: { select: { isActive: true } }, _count: { select: { showtimes: true } } },
    orderBy: { name: "asc" },
  });
  return halls.map((h) => ({
    id: h.id,
    name: h.name,
    layoutRows: h.layoutRows,
    layoutCols: h.layoutCols,
    seatCount: h.seats.length,
    activeSeatCount: h.seats.filter((s) => s.isActive).length,
    showtimeCount: h._count.showtimes,
  }));
}

/**
 * Loads a hall with all its seats.
 *
 * @param id - The hall id.
 * @returns The hall and seats, row by row.
 * @throws AppError 404 if not found.
 */
export async function getHall(id: number): Promise<IHallDetail> {
  const hall = await prisma.hall.findUnique({
    where: { id },
    include: { seats: { orderBy: [{ gridRow: "asc" }, { gridCol: "asc" }] }, _count: { select: { showtimes: true } } },
  });
  if (!hall) throw notFound("Hall");
  return {
    id: hall.id,
    name: hall.name,
    layoutRows: hall.layoutRows,
    layoutCols: hall.layoutCols,
    seatCount: hall.seats.length,
    activeSeatCount: hall.seats.filter((s) => s.isActive).length,
    showtimeCount: hall._count.showtimes,
    seats: hall.seats.map(({ hallId: _hallId, ...seat }) => seat),
  };
}

/**
 * Generates a hall layout without saving it, for the layout editor preview.
 *
 * @param rows - Row descriptions, front row first.
 * @returns Grid size and seats (no ids).
 * @throws AppError 400 if the layout is invalid.
 */
export function previewHall(rows: IHallRowSpec[]) {
  const { layoutRows, layoutCols, seats } = buildHall("Preview", rows);
  return { layoutRows, layoutCols, seatCount: seats.length, seats };
}

/**
 * Creates a hall and its seats from a row description.
 *
 * @param name - Hall name (unique).
 * @param rows - Row descriptions, front row first.
 * @returns The new hall.
 * @throws AppError 400 for an invalid layout, 409 if the name is taken.
 */
export async function createHall(name: string, rows: IHallRowSpec[]): Promise<IHallDetail> {
  const { seats, ...hall } = buildHall(name.trim(), rows);
  try {
    const created = await prisma.hall.create({ data: { ...hall, seats: { create: seats } } });
    return getHall(created.id);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict(`A hall called "${hall.name}" already exists.`);
    }
    throw err;
  }
}

/**
 * Renames a hall.
 *
 * @param id - The hall id.
 * @param name - New name (unique).
 * @returns The hall.
 * @throws AppError 404 if not found, 409 if the name is taken.
 */
export async function renameHall(id: number, name: string): Promise<IHallDetail> {
  if (!(await prisma.hall.count({ where: { id } }))) throw notFound("Hall");
  try {
    await prisma.hall.update({ where: { id }, data: { name: name.trim() } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict(`A hall called "${name.trim()}" already exists.`);
    }
    throw err;
  }
  return getHall(id);
}

/**
 * Replaces a hall's whole seat layout. Only allowed while the hall has no
 * showings; after that, switch single seats off with {@link updateSeat}.
 *
 * @param id - The hall id.
 * @param rows - New row descriptions.
 * @returns The hall with its new seats.
 * @throws AppError 404 if not found, 400 for an invalid layout, 409 if the hall has showings.
 */
export async function replaceHallLayout(id: number, rows: IHallRowSpec[]): Promise<IHallDetail> {
  const existing = await prisma.hall.findUnique({ where: { id }, include: { _count: { select: { showtimes: true } } } });
  if (!existing) throw notFound("Hall");
  if (existing._count.showtimes) {
    throw conflict("This hall has showings, so its layout can't be replaced. Switch single seats off instead.");
  }
  const { seats, layoutRows, layoutCols } = buildHall(existing.name, rows);
  await prisma.$transaction([
    prisma.seat.deleteMany({ where: { hallId: id } }),
    prisma.hall.update({ where: { id }, data: { layoutRows, layoutCols, seats: { create: seats } } }),
  ]);
  return getHall(id);
}

/**
 * Changes one seat: switch it off (e.g. broken) or change its type. Couple
 * seats take two grid cells, so seats can't be changed to or from couple.
 *
 * @param hallId - The hall.
 * @param seatId - The seat.
 * @param input - New active state and/or type.
 * @returns The updated seat.
 * @throws AppError 404 if the seat isn't in this hall, 400 for a couple change.
 */
export async function updateSeat(hallId: number, seatId: number, input: { isActive?: boolean; type?: SeatType }): Promise<Seat> {
  const seat = await prisma.seat.findFirst({ where: { id: seatId, hallId } });
  if (!seat) throw notFound("Seat");
  if (input.type && input.type !== seat.type && (input.type === "couple" || seat.type === "couple")) {
    throw badRequest("Couple seats take two places on the plan, so a seat can't be changed to or from couple. Replace the layout instead.");
  }
  return prisma.seat.update({ where: { id: seatId }, data: input });
}

/**
 * Deletes a hall that has no showings.
 *
 * @param id - The hall id.
 * @throws AppError 404 if not found, 409 if it has showings.
 */
export async function deleteHall(id: number): Promise<void> {
  const hall = await prisma.hall.findUnique({ where: { id }, include: { _count: { select: { showtimes: true } } } });
  if (!hall) throw notFound("Hall");
  if (hall._count.showtimes) throw conflict("This hall has showings. Delete or cancel them first.");
  await prisma.hall.delete({ where: { id } });
}

// ---------------------------------------------------------------- showtimes

/**
 * Fields an admin sets on a showing. Prices are in MMK.
 */
export interface IShowtimeInput {
  movieId: number;
  hallId: number;
  startsAt: Date;
  priceStandard: number;
  priceVip: number;
  priceCouple: number;
  fullHallPrice?: number | null;
}

/**
 * A showing in the admin list.
 */
export type IAdminShowtime = IShowtimeSummary & { movieTitle: string; priceStandard: number; priceVip: number; priceCouple: number; fullHallPrice: number | null };

/**
 * Throws if another scheduled showing in the hall overlaps the given time.
 *
 * @param hallId - The hall.
 * @param startsAt - Start of the new time.
 * @param endsAt - End of the new time (including cleaning).
 * @param excludeId - Showing to ignore (the one being edited).
 * @throws AppError 409 naming the clashing showing.
 */
async function assertNoOverlap(hallId: number, startsAt: Date, endsAt: Date, excludeId?: number): Promise<void> {
  const clash = await prisma.showtime.findFirst({
    where: {
      hallId,
      status: "scheduled",
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeId && { id: { not: excludeId } }),
    },
    include: { movie: true },
  });
  if (clash) {
    throw conflict(`The hall is busy: "${clash.movie.title}" runs from ${clash.startsAt.toISOString()} to ${clash.endsAt.toISOString()}.`, {
      showtimeId: clash.id,
    });
  }
}

/**
 * Lists showings with seat and revenue figures, soonest first.
 *
 * @param filter - Optional start-time range, movie and hall.
 * @returns The showings.
 */
export async function listShowtimes(filter: { from?: Date; to?: Date; movieId?: number; hallId?: number }): Promise<IAdminShowtime[]> {
  const where: Prisma.ShowtimeWhereInput = {};
  if (filter.movieId) where.movieId = filter.movieId;
  if (filter.hallId) where.hallId = filter.hallId;
  if (filter.from || filter.to) where.startsAt = { ...(filter.from && { gte: filter.from }), ...(filter.to && { lt: filter.to }) };

  const showtimes = await prisma.showtime.findMany({ where, include: { hall: true, movie: true }, orderBy: { startsAt: "asc" } });
  const summaries = await summarizeShowtimes(showtimes);
  return summaries.map((s, i) => ({
    ...s,
    movieTitle: showtimes[i].movie.title,
    priceStandard: showtimes[i].priceStandard,
    priceVip: showtimes[i].priceVip,
    priceCouple: showtimes[i].priceCouple,
    fullHallPrice: showtimes[i].fullHallPrice,
  }));
}

/**
 * Loads one showing for the admin.
 *
 * @param id - The showing id.
 * @returns The showing.
 * @throws AppError 404 if not found.
 */
export async function getAdminShowtime(id: number): Promise<IAdminShowtime> {
  const showtime = await prisma.showtime.findUnique({ where: { id }, include: { hall: true, movie: true } });
  if (!showtime) throw notFound("Showing");
  const [summary] = await summarizeShowtimes([showtime]);
  return {
    ...summary,
    movieTitle: showtime.movie.title,
    priceStandard: showtime.priceStandard,
    priceVip: showtime.priceVip,
    priceCouple: showtime.priceCouple,
    fullHallPrice: showtime.fullHallPrice,
  };
}

/**
 * Schedules a showing. The end time is the film length plus cleaning time,
 * and it must not overlap another showing in the same hall.
 *
 * @param input - Movie, hall, start time and prices.
 * @param now - Current time.
 * @returns The new showing.
 * @throws AppError 404 if the movie or hall doesn't exist, 400 if the time is in the past, 409 on overlap.
 */
export async function createShowtime(input: IShowtimeInput, now: Date = new Date()): Promise<IAdminShowtime> {
  const [movie, hall] = await Promise.all([
    prisma.movie.findUnique({ where: { id: input.movieId } }),
    prisma.hall.findUnique({ where: { id: input.hallId } }),
  ]);
  if (!movie) throw notFound("Movie");
  if (!hall) throw notFound("Hall");
  if (input.startsAt.getTime() <= now.getTime()) throw badRequest("A showing must start in the future.");

  const endsAt = computeEndsAt(input.startsAt, movie.durationMin);
  await assertNoOverlap(input.hallId, input.startsAt, endsAt);
  const showtime = await prisma.showtime.create({ data: { ...input, fullHallPrice: input.fullHallPrice ?? null, endsAt } });
  return getAdminShowtime(showtime.id);
}

/**
 * Changes a showing. Prices can always change (they apply to new bookings);
 * movie, hall and time can only change while nobody has booked.
 *
 * @param id - The showing id.
 * @param input - Fields to change.
 * @param now - Current time.
 * @returns The updated showing.
 * @throws AppError 404 if not found, 400 for a past time, 409 if cancelled, booked, or overlapping.
 */
export async function updateShowtime(id: number, input: Partial<IShowtimeInput>, now: Date = new Date()): Promise<IAdminShowtime> {
  const existing = await prisma.showtime.findUnique({ where: { id }, include: { movie: true } });
  if (!existing) throw notFound("Showing");
  if (existing.status === "cancelled") throw conflict("This showing is cancelled and can't be changed.");

  const movesShow =
    (input.movieId !== undefined && input.movieId !== existing.movieId) ||
    (input.hallId !== undefined && input.hallId !== existing.hallId) ||
    (input.startsAt !== undefined && input.startsAt.getTime() !== existing.startsAt.getTime());

  let endsAt = existing.endsAt;
  if (movesShow) {
    const booked = await prisma.booking.count({ where: { showtimeId: id, status: "confirmed" } });
    if (booked) throw conflict("This showing has bookings, so its movie, hall and time can't change. You can still change prices.");

    const movie = input.movieId ? await prisma.movie.findUnique({ where: { id: input.movieId } }) : existing.movie;
    if (!movie) throw notFound("Movie");
    const hallId = input.hallId ?? existing.hallId;
    if (input.hallId && !(await prisma.hall.count({ where: { id: input.hallId } }))) throw notFound("Hall");
    const startsAt = input.startsAt ?? existing.startsAt;
    if (startsAt.getTime() <= now.getTime()) throw badRequest("A showing must start in the future.");

    endsAt = computeEndsAt(startsAt, movie.durationMin);
    await assertNoOverlap(hallId, startsAt, endsAt, id);
  }

  await prisma.showtime.update({ where: { id }, data: { ...input, endsAt } });
  return getAdminShowtime(id);
}

/**
 * Cancels a showing and all its confirmed bookings, freeing every seat.
 *
 * @param id - The showing id.
 * @param now - Current time.
 * @returns How many bookings were cancelled.
 * @throws AppError 404 if not found, 409 if already cancelled.
 */
export async function cancelShowtime(id: number, now: Date = new Date()): Promise<{ cancelledBookings: number }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM showtimes WHERE id = ${id} FOR UPDATE`;
    const showtime = await tx.showtime.findUnique({ where: { id } });
    if (!showtime) throw notFound("Showing");
    if (showtime.status === "cancelled") throw conflict("This showing is already cancelled.");

    await tx.showtime.update({ where: { id }, data: { status: "cancelled" } });
    const { count } = await tx.booking.updateMany({
      where: { showtimeId: id, status: "confirmed" },
      data: { status: "cancelled", cancelledAt: now },
    });
    await tx.bookingSeat.updateMany({ where: { showtimeId: id }, data: { showtimeId: null } });
    return { cancelledBookings: count };
  });
}

/**
 * Deletes a showing that has never been booked.
 *
 * @param id - The showing id.
 * @throws AppError 404 if not found, 409 if it has any bookings (cancel it instead).
 */
export async function deleteShowtime(id: number): Promise<void> {
  const showtime = await prisma.showtime.findUnique({ where: { id }, include: { _count: { select: { bookings: true } } } });
  if (!showtime) throw notFound("Showing");
  if (showtime._count.bookings) throw conflict("This showing has bookings. Cancel it instead of deleting it.");
  await prisma.showtime.delete({ where: { id } });
}
