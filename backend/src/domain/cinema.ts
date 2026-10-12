import type { ShowtimeStatus } from "@prisma/client";
import type { IMovie } from "./movie.js";

/**
 * A user review of a movie.
 */
export interface IReview {
  id: number;
  movieId: number;
  userId: number;
  userName: string;
  /** Score from 1 to 10. */
  score: number;
  comment: string;
  createdAt: Date;
}

/**
 * Prices (MMK) of the seat types that exist in a showing's hall.
 */
export interface ISeatPrices {
  standard?: number;
  vip?: number;
  couple?: number;
}

/**
 * A showing with its seat counts and money, loaded from the database.
 */
export interface IShowtimeSummary {
  id: number;
  movieId: number;
  hallId: number;
  hallName: string;
  startsAt: Date;
  endsAt: Date;
  status: ShowtimeStatus;
  /** Active seats in the hall. */
  totalSeats: number;
  bookedSeats: number;
  prices: ISeatPrices;
  /** Sum of confirmed bookings, in MMK. */
  revenue: number;
  bookingCount: number;
  hasFullHallBooking: boolean;
}

/**
 * Showtime info as seen by a customer.
 */
export interface IUserShowtime {
  showtimeId: number;
  startsAt: Date;
  hallName: string;
  totalSeats: number;
  availableSeats: number;
  prices: ISeatPrices;
  /** Cheapest seat price, for "from 8,000 MMK". */
  priceFrom: number | null;
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
  movieId: number;
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
  fullHallBookings: number;
}

/**
 * One showing in the admin dashboard's showtime table.
 */
export interface IAdminShowtimeRow {
  showtimeId: number;
  movieId: number;
  movieTitle: string;
  hallName: string;
  startsAt: Date;
  status: ShowtimeStatus;
  totalSeats: number;
  bookedSeats: number;
  occupancyRate: number;
  revenue: number;
  bookingCount: number;
  isFullHall: boolean;
}

/**
 * Aggregated data for the admin dashboard.
 */
export interface IAdminDashboard {
  movies: IAdminMovieStats[];
  showtimes: IAdminShowtimeRow[];
  totals: {
    movieCount: number;
    reviewCount: number;
    showtimeCount: number;
    bookingCount: number;
    fullHallBookings: number;
    totalSeats: number;
    bookedSeats: number;
    availableSeats: number;
    occupancyRate: number;
    revenue: number;
  };
  /** Reviews with a score of 3 or lower, newest first, for moderation. */
  lowScoreReviews: IReview[];
}

/** Reviews at or below this score are flagged for the admin. */
export const LOW_SCORE_THRESHOLD = 3;

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
 * Returns booked seats as a percentage of total seats.
 *
 * @param booked - Booked seats.
 * @param total - Total seats.
 * @returns Percentage 0–100, rounded to two decimals; 0 when there are no seats.
 */
export function occupancyRate(booked: number, total: number): number {
  return total === 0 ? 0 : round2((booked / total) * 100);
}

/**
 * Computes the average score of a list of reviews.
 *
 * @param reviews - The reviews to average.
 * @returns The average score rounded to two decimals, or null if there are no reviews.
 */
export function averageScore(reviews: { score: number }[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + r.score, 0);
  return round2(sum / reviews.length);
}

/**
 * Builds the customer-facing view of a movie: reviews (newest first) and
 * upcoming, not-cancelled showtimes with available seats and prices.
 *
 * @param movie - The movie to display.
 * @param reviews - Reviews; only those for this movie are used.
 * @param showtimes - Showtimes; only upcoming scheduled ones for this movie are used.
 * @param now - Reference time for filtering past showtimes.
 * @returns The user view for the movie.
 */
export function getUserMovieView(
  movie: IMovie,
  reviews: IReview[],
  showtimes: IShowtimeSummary[],
  now: Date = new Date(),
): IUserMovieView {
  const movieReviews = reviews
    .filter((r) => r.movieId === movie.id)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const upcoming = showtimes
    .filter((s) => s.movieId === movie.id && s.status === "scheduled" && s.startsAt.getTime() > now.getTime())
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((s): IUserShowtime => {
      const available = Math.max(0, s.totalSeats - s.bookedSeats);
      const prices = Object.values(s.prices).filter((p): p is number => p !== undefined);
      return {
        showtimeId: s.id,
        startsAt: s.startsAt,
        hallName: s.hallName,
        totalSeats: s.totalSeats,
        availableSeats: available,
        prices: s.prices,
        priceFrom: prices.length ? Math.min(...prices) : null,
        soldOut: available === 0,
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
 * Builds the admin dashboard: per-movie and per-showing seat, occupancy and
 * revenue figures plus totals. Cancelled showings are left out of seat and
 * occupancy figures; revenue comes from confirmed bookings only.
 *
 * @param movies - All movies to report on.
 * @param reviews - All reviews.
 * @param showtimes - Showtimes in the reporting period.
 * @returns The dashboard data. Movies sorted by revenue (highest first), showtimes by start time.
 */
export function getAdminDashboard(
  movies: IMovie[],
  reviews: IReview[],
  showtimes: IShowtimeSummary[],
): IAdminDashboard {
  const titles = new Map(movies.map((m) => [m.id, m.title]));
  const active = showtimes.filter((s) => s.status === "scheduled");

  const stats = movies.map((movie): IAdminMovieStats => {
    const movieReviews = reviews.filter((r) => r.movieId === movie.id);
    const shows = active.filter((s) => s.movieId === movie.id);
    const totalSeats = shows.reduce((acc, s) => acc + s.totalSeats, 0);
    const bookedSeats = shows.reduce((acc, s) => acc + Math.min(s.bookedSeats, s.totalSeats), 0);

    return {
      movieId: movie.id,
      title: movie.title,
      averageScore: averageScore(movieReviews),
      reviewCount: movieReviews.length,
      showtimeCount: shows.length,
      totalSeats,
      bookedSeats,
      availableSeats: totalSeats - bookedSeats,
      occupancyRate: occupancyRate(bookedSeats, totalSeats),
      revenue: shows.reduce((acc, s) => acc + s.revenue, 0),
      fullHallBookings: shows.filter((s) => s.hasFullHallBooking).length,
    };
  });
  stats.sort((a, b) => b.revenue - a.revenue);

  const rows = [...showtimes]
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((s): IAdminShowtimeRow => ({
      showtimeId: s.id,
      movieId: s.movieId,
      movieTitle: titles.get(s.movieId) ?? "Unknown movie",
      hallName: s.hallName,
      startsAt: s.startsAt,
      status: s.status,
      totalSeats: s.totalSeats,
      bookedSeats: s.bookedSeats,
      occupancyRate: occupancyRate(s.bookedSeats, s.totalSeats),
      revenue: s.revenue,
      bookingCount: s.bookingCount,
      isFullHall: s.hasFullHallBooking,
    }));

  const totalSeats = stats.reduce((acc, m) => acc + m.totalSeats, 0);
  const bookedSeats = stats.reduce((acc, m) => acc + m.bookedSeats, 0);

  return {
    movies: stats,
    showtimes: rows,
    totals: {
      movieCount: stats.length,
      reviewCount: reviews.length,
      showtimeCount: active.length,
      bookingCount: active.reduce((acc, s) => acc + s.bookingCount, 0),
      fullHallBookings: stats.reduce((acc, m) => acc + m.fullHallBookings, 0),
      totalSeats,
      bookedSeats,
      availableSeats: totalSeats - bookedSeats,
      occupancyRate: occupancyRate(bookedSeats, totalSeats),
      revenue: stats.reduce((acc, m) => acc + m.revenue, 0),
    },
    lowScoreReviews: reviews
      .filter((r) => r.score <= LOW_SCORE_THRESHOLD)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
  };
}
