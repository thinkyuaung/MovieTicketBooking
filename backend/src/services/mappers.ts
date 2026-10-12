import type { Genre, Movie, MovieGenre, Review, Showtime, User } from "@prisma/client";
import type { IReview } from "../domain/cinema.js";
import type { IMovie } from "../domain/movie.js";
import type { IShowtimePrices } from "../domain/pricing.js";

/** Prisma include that loads a movie's genre names. */
export const movieInclude = { genres: { include: { genre: true } } } as const;

/**
 * Converts a Prisma movie (with genres) to the domain movie.
 *
 * @param movie - Movie loaded with {@link movieInclude}.
 * @returns The domain movie.
 */
export function toMovie(movie: Movie & { genres: (MovieGenre & { genre: Genre })[] }): IMovie {
  return {
    id: movie.id,
    title: movie.title,
    director: movie.director,
    releaseYear: movie.releaseYear,
    genres: movie.genres.map((g) => g.genre.name).sort(),
    durationMinutes: movie.durationMin,
    ageRating: movie.ageRating,
    description: movie.description,
    posterUrl: movie.posterUrl,
  };
}

/**
 * Converts a Prisma review (with its user) to the domain review.
 *
 * @param review - Review loaded with its user.
 * @returns The domain review.
 */
export function toReview(review: Review & { user: Pick<User, "name"> }): IReview {
  return {
    id: review.id,
    movieId: review.movieId,
    userId: review.userId,
    userName: review.user.name,
    score: review.score,
    comment: review.comment,
    createdAt: review.createdAt,
  };
}

/**
 * Picks a showtime's prices.
 *
 * @param showtime - The showtime.
 * @returns Its prices in MMK.
 */
export function toPrices(showtime: Showtime): IShowtimePrices {
  return {
    priceStandard: showtime.priceStandard,
    priceVip: showtime.priceVip,
    priceCouple: showtime.priceCouple,
    fullHallPrice: showtime.fullHallPrice,
  };
}
