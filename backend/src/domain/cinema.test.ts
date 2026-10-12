import { describe, expect, it } from "vitest";
import { getAdminDashboard, getUserMovieView, type IReview, type IShowtimeSummary } from "./cinema.js";
import type { IMovie } from "./movie.js";

const movie: IMovie = {
  id: 1,
  title: "Coco",
  director: "Lee Unkrich",
  releaseYear: 2017,
  genres: ["Animation"],
  durationMinutes: 105,
  ageRating: "PG",
  description: null,
  posterUrl: null,
};
const now = new Date("2026-10-12T00:00:00Z");
const reviews: IReview[] = [
  { id: 1, movieId: 1, userId: 1, userName: "Su", score: 9, comment: "Great", createdAt: new Date("2026-10-01") },
  { id: 2, movieId: 1, userId: 2, userName: "Min", score: 2, comment: "Meh", createdAt: new Date("2026-10-05") },
];

/**
 * Builds a showtime summary with sensible defaults.
 *
 * @param over - Fields to override.
 * @returns The summary.
 */
function show(over: Partial<IShowtimeSummary>): IShowtimeSummary {
  return {
    id: 1,
    movieId: 1,
    hallId: 1,
    hallName: "Hall 1",
    startsAt: new Date("2026-10-13T12:00:00Z"),
    endsAt: new Date("2026-10-13T14:00:00Z"),
    status: "scheduled",
    totalSeats: 10,
    bookedSeats: 0,
    prices: { standard: 8000, vip: 15000 },
    revenue: 0,
    bookingCount: 0,
    hasFullHallBooking: false,
    ...over,
  };
}

const showtimes = [
  show({ id: 1, startsAt: new Date("2026-10-11T12:00:00Z"), bookedSeats: 4, revenue: 32000, bookingCount: 2 }),
  show({ id: 2, bookedSeats: 10, revenue: 100000, bookingCount: 1, hasFullHallBooking: true }),
  show({ id: 3, status: "cancelled", bookedSeats: 0 }),
];

describe("getUserMovieView", () => {
  const view = getUserMovieView(movie, reviews, showtimes, now);

  it("averages reviews and lists newest first", () => {
    expect(view.averageScore).toBe(5.5);
    expect(view.reviews[0].id).toBe(2);
  });

  it("hides past and cancelled showtimes and flags sold-out ones", () => {
    expect(view.showtimes).toHaveLength(1);
    expect(view.showtimes[0]).toMatchObject({ showtimeId: 2, availableSeats: 0, soldOut: true });
  });

  it("shows the cheapest price as 'from'", () => {
    expect(view.showtimes[0].priceFrom).toBe(8000);
  });
});

describe("getAdminDashboard", () => {
  const dash = getAdminDashboard([movie], reviews, showtimes);

  it("totals seats, occupancy and revenue, leaving out cancelled showings", () => {
    expect(dash.totals).toMatchObject({
      showtimeCount: 2,
      bookedSeats: 14,
      totalSeats: 20,
      occupancyRate: 70,
      revenue: 132000,
      bookingCount: 3,
      fullHallBookings: 1,
    });
  });

  it("lists every showing in time order with its occupancy", () => {
    expect(dash.showtimes.map((s) => s.showtimeId)).toEqual([1, 2, 3]);
    expect(dash.showtimes[1]).toMatchObject({ occupancyRate: 100, isFullHall: true, movieTitle: "Coco" });
  });

  it("flags low reviews", () => {
    expect(dash.lowScoreReviews.map((r) => r.id)).toEqual([2]);
  });
});
