import type { IMovie } from "./movie.js";

/**
 * A user review of a movie.
 */
export interface IReview {
  id: string;
  movieId: string;
  userName: string;
  /** Score from 1 to 10. */
  score: number;
  comment: string;
  createdAt: Date;
}

/**
 * A scheduled screening of a movie with its seating and pricing.
 */
export interface IShowtime {
  id: string;
  movieId: string;
  startsAt: Date;
  hall: string;
  totalSeats: number;
  bookedSeats: number;
  /** Ticket price per seat. */
  price: number;
}

/**
 * Showtime info as seen by a customer.
 */
export interface IUserShowtime {
  showtimeId: string;
  startsAt: Date;
  hall: string;
  availableSeats: number;
  price: number;
  soldOut: boolean;
}

/**
 * Everything a customer sees on a movie's page.
 */
export interface IUserMovieView {
  movie: IMovie;
  averageScore: number | null;
  reviewCount: number;
  reviews: IReview[];
  showtimes: IUserShowtime[];
}

/**
 * Per-movie statistics for the admin dashboard.
 */
export interface IAdminMovieStats {
  movieId: string;
  title: string;
  averageScore: number | null;
  reviewCount: number;
  showtimeCount: number;
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
  /** Booked seats as a percentage of total seats (0-100). */
  occupancyRate: number;
  revenue: number;
  minPrice: number | null;
  maxPrice: number | null;
}

/**
 * Aggregated data for the admin dashboard.
 */
export interface IAdminDashboard {
  movies: IAdminMovieStats[];
  totals: {
    movieCount: number;
    reviewCount: number;
    showtimeCount: number;
    totalSeats: number;
    bookedSeats: number;
    availableSeats: number;
    occupancyRate: number;
    revenue: number;
  };
  /** Reviews with a score of 3 or lower, newest first, for moderation. */
  lowScoreReviews: IReview[];
}

/**
 * Rounds a number to two decimal places.
 *
 * @param value - The number to round.
 * @returns The rounded number.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Computes the average score of a list of reviews.
 *
 * @param reviews - The reviews to average.
 * @returns The average score rounded to two decimals, or null if there are no reviews.
 */
export function averageScore(reviews: IReview[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + r.score, 0);
  return round2(sum / reviews.length);
}

/**
 * Returns the number of seats still available for a showtime.
 *
 * @param showtime - The showtime to check.
 * @returns Available seats, never negative.
 */
export function availableSeats(showtime: IShowtime): number {
  return Math.max(0, showtime.totalSeats - showtime.bookedSeats);
}

/**
 * Builds the customer-facing view of a movie: reviews (newest first) and
 * upcoming showtimes with available seats and price.
 *
 * @param movie - The movie to display.
 * @param reviews - All reviews; only those for this movie are used.
 * @param showtimes - All showtimes; only upcoming ones for this movie are used.
 * @param now - Reference time for filtering past showtimes (defaults to the current time).
 * @returns The user view for the movie.
 */
export function getUserMovieView(
  movie: IMovie,
  reviews: IReview[],
  showtimes: IShowtime[],
  now: Date = new Date(),
): IUserMovieView {
  const movieReviews = reviews
    .filter((r) => r.movieId === movie.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const upcoming = showtimes
    .filter((s) => s.movieId === movie.id && s.startsAt.getTime() > now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((s): IUserShowtime => {
      const seats = availableSeats(s);
      return {
        showtimeId: s.id,
        startsAt: s.startsAt,
        hall: s.hall,
        availableSeats: seats,
        price: s.price,
        soldOut: seats === 0,
      };
    });

  return {
    movie,
    averageScore: averageScore(movieReviews),
    reviewCount: movieReviews.length,
    reviews: movieReviews,
    showtimes: upcoming,
  };
}

/**
 * Builds the admin dashboard: per-movie review, seat, occupancy and revenue
 * statistics plus overall totals. Revenue is booked seats times price.
 *
 * @param movies - All movies to report on.
 * @param reviews - All reviews.
 * @param showtimes - All showtimes (past and upcoming).
 * @returns The aggregated dashboard data, movies sorted by revenue descending.
 */
export function getAdminDashboard(
  movies: IMovie[],
  reviews: IReview[],
  showtimes: IShowtime[],
): IAdminDashboard {
  const stats = movies.map((movie): IAdminMovieStats => {
    const movieReviews = reviews.filter((r) => r.movieId === movie.id);
    const movieShowtimes = showtimes.filter((s) => s.movieId === movie.id);

    const totalSeats = movieShowtimes.reduce((acc, s) => acc + s.totalSeats, 0);
    const bookedSeats = movieShowtimes.reduce(
      (acc, s) => acc + Math.min(s.bookedSeats, s.totalSeats),
      0,
    );
    const revenue = movieShowtimes.reduce(
      (acc, s) => acc + Math.min(s.bookedSeats, s.totalSeats) * s.price,
      0,
    );
    const prices = movieShowtimes.map((s) => s.price);

    return {
      movieId: movie.id,
      title: movie.title,
      averageScore: averageScore(movieReviews),
      reviewCount: movieReviews.length,
      showtimeCount: movieShowtimes.length,
      totalSeats,
      bookedSeats,
      availableSeats: totalSeats - bookedSeats,
      occupancyRate: totalSeats === 0 ? 0 : round2((bookedSeats / totalSeats) * 100),
      revenue: round2(revenue),
      minPrice: prices.length ? Math.min(...prices) : null,
      maxPrice: prices.length ? Math.max(...prices) : null,
    };
  });

  stats.sort((a, b) => b.revenue - a.revenue);

  const totalSeats = stats.reduce((acc, m) => acc + m.totalSeats, 0);
  const bookedSeats = stats.reduce((acc, m) => acc + m.bookedSeats, 0);

  return {
    movies: stats,
    totals: {
      movieCount: stats.length,
      reviewCount: stats.reduce((acc, m) => acc + m.reviewCount, 0),
      showtimeCount: stats.reduce((acc, m) => acc + m.showtimeCount, 0),
      totalSeats,
      bookedSeats,
      availableSeats: totalSeats - bookedSeats,
      occupancyRate: totalSeats === 0 ? 0 : round2((bookedSeats / totalSeats) * 100),
      revenue: round2(stats.reduce((acc, m) => acc + m.revenue, 0)),
    },
    lowScoreReviews: reviews
      .filter((r) => r.score <= 3)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  };
}
