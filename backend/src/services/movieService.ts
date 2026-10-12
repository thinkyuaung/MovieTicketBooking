import type { Prisma } from "@prisma/client";
import { getUserMovieView, type IUserMovieView } from "../domain/cinema.js";
import type { IMovie } from "../domain/movie.js";
import { prisma } from "../db.js";
import { notFound } from "../errors.js";
import { movieInclude, toMovie, toReview } from "./mappers.js";
import { summarizeShowtimes } from "./showtimeStats.js";

/**
 * A movie in the movie list.
 */
export interface IMovieListItem extends IMovie {
  averageScore: number | null;
  reviewCount: number;
  /** Start of the next bookable showing, or null if none is scheduled. */
  nextShowtime: Date | null;
}

/**
 * Lists movies with their average score and next showing.
 *
 * @param filter - Optional title search and genre name.
 * @param now - Current time.
 * @returns Movies with upcoming showings first (soonest first), then the rest by title.
 */
export async function listMovies(filter: { q?: string; genre?: string }, now: Date = new Date()): Promise<IMovieListItem[]> {
  const where: Prisma.MovieWhereInput = {};
  if (filter.q) where.title = { contains: filter.q };
  if (filter.genre) where.genres = { some: { genre: { name: filter.genre } } };

  const [movies, scores, next] = await Promise.all([
    prisma.movie.findMany({ where, include: movieInclude, orderBy: { title: "asc" } }),
    prisma.review.groupBy({ by: ["movieId"], _avg: { score: true }, _count: { _all: true } }),
    prisma.showtime.groupBy({
      by: ["movieId"],
      where: { status: "scheduled", startsAt: { gt: now } },
      _min: { startsAt: true },
    }),
  ]);
  const scoreBy = new Map(scores.map((s) => [s.movieId, s]));
  const nextBy = new Map(next.map((n) => [n.movieId, n._min.startsAt]));

  return movies
    .map((m) => {
      const score = scoreBy.get(m.id);
      return {
        ...toMovie(m),
        averageScore: score?._avg.score != null ? Math.round(score._avg.score * 100) / 100 : null,
        reviewCount: score?._count._all ?? 0,
        nextShowtime: nextBy.get(m.id) ?? null,
      };
    })
    .sort((a, b) => {
      if (a.nextShowtime && b.nextShowtime) return a.nextShowtime.getTime() - b.nextShowtime.getTime();
      if (a.nextShowtime) return -1;
      if (b.nextShowtime) return 1;
      return a.title.localeCompare(b.title);
    });
}

/**
 * Loads a movie's page: details, reviews and upcoming showings with free seats and prices.
 *
 * @param id - The movie id.
 * @param now - Current time.
 * @returns The movie view.
 * @throws AppError 404 if the movie doesn't exist.
 */
export async function getMovieView(id: number, now: Date = new Date()): Promise<IUserMovieView> {
  const movie = await prisma.movie.findUnique({
    where: { id },
    include: {
      ...movieInclude,
      reviews: { include: { user: { select: { name: true } } } },
      showtimes: { where: { status: "scheduled", startsAt: { gt: now } }, include: { hall: true } },
    },
  });
  if (!movie) throw notFound("Movie");

  const summaries = await summarizeShowtimes(movie.showtimes);
  return getUserMovieView(toMovie(movie), movie.reviews.map(toReview), summaries, now);
}

/**
 * Lists all genre names, for the genre filter.
 *
 * @returns Genre names A–Z.
 */
export async function listGenres(): Promise<string[]> {
  const genres = await prisma.genre.findMany({ orderBy: { name: "asc" } });
  return genres.map((g) => g.name);
}
