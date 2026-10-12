// Shapes of the backend's JSON responses. Dates arrive as ISO strings.

export type SeatType = "standard" | "vip" | "couple" | "wheelchair";
export type AgeRating = "G" | "PG" | "PG13" | "R";

export interface IUser {
  id: number;
  name: string;
  role: "user" | "admin";
  email: string;
  phone: string | null;
}

export interface IAuthResult {
  token: string;
  user: IUser;
}

export interface IMovie {
  id: number;
  title: string;
  director: string;
  releaseYear: number;
  genres: string[];
  durationMinutes: number;
  ageRating: AgeRating;
  description: string | null;
  posterUrl: string | null;
}

export interface IMovieListItem extends IMovie {
  averageScore: number | null;
  reviewCount: number;
  nextShowtime: string | null;
}

export interface IReview {
  id: number;
  movieId: number;
  userId: number;
  userName: string;
  score: number;
  comment: string;
  createdAt: string;
}

export interface ISeatPrices {
  standard?: number;
  vip?: number;
  couple?: number;
}

export interface IUserShowtime {
  showtimeId: number;
  startsAt: string;
  hallName: string;
  totalSeats: number;
  availableSeats: number;
  prices: ISeatPrices;
  priceFrom: number | null;
  soldOut: boolean;
}

export interface IMovieView {
  movie: IMovie;
  averageScore: number | null;
  reviewCount: number;
  reviews: IReview[];
  showtimes: IUserShowtime[];
}

/** A seat drawn on a plan. `id` and `price` are absent in a layout preview. */
export interface IPlanSeat {
  id?: number;
  label: string;
  rowLabel: string;
  number: number;
  gridRow: number;
  gridCol: number;
  width: number;
  type: SeatType;
  price?: number;
  status: "available" | "taken" | "unavailable";
}

export interface IFullHall {
  eligible: boolean;
  blockedBy: "too_soon" | "already_booked" | "cancelled" | null;
  reason: string | null;
  price: number;
}

export interface ISeatPlan {
  layoutRows: number;
  layoutCols: number;
  rows: { rowLabel: string; gridRow: number }[];
  seats: IPlanSeat[];
  counts: { total: number; available: number; taken: number };
  fullHall: IFullHall;
}

export interface IShowtimeSeatPlan {
  showtime: {
    id: number;
    startsAt: string;
    endsAt: string;
    status: "scheduled" | "cancelled";
    movie: { id: number; title: string; durationMin: number; ageRating: AgeRating };
    hall: { id: number; name: string };
  };
  plan: ISeatPlan;
}

export interface IBooking {
  id: number;
  bookingCode: string;
  status: "confirmed" | "cancelled";
  isFullHall: boolean;
  totalPrice: number;
  createdAt: string;
  cancelledAt: string | null;
  canCancel: boolean;
  showtime: {
    id: number;
    startsAt: string;
    endsAt: string;
    status: "scheduled" | "cancelled";
    movieId: number;
    movieTitle: string;
    hallName: string;
  };
  seatCount: number;
  seats: { label: string; type: SeatType; price: number }[];
}

export interface IAdminBooking extends IBooking {
  customer: { id: number; name: string; email: string; phone: string | null };
}

export interface IAdminMovieStats {
  movieId: number;
  title: string;
  averageScore: number | null;
  reviewCount: number;
  showtimeCount: number;
  totalSeats: number;
  bookedSeats: number;
  availableSeats: number;
  occupancyRate: number;
  revenue: number;
  fullHallBookings: number;
}

export interface IAdminShowtimeRow {
  showtimeId: number;
  movieId: number;
  movieTitle: string;
  hallName: string;
  startsAt: string;
  status: "scheduled" | "cancelled";
  totalSeats: number;
  bookedSeats: number;
  occupancyRate: number;
  revenue: number;
  bookingCount: number;
  isFullHall: boolean;
}

export interface IDashboard {
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
  lowScoreReviews: IReview[];
  range: { from: string | null; to: string | null };
}

export interface IAdminMovie extends IMovie {
  showtimeCount: number;
}

export interface IHallListItem {
  id: number;
  name: string;
  layoutRows: number;
  layoutCols: number;
  seatCount: number;
  activeSeatCount: number;
  showtimeCount: number;
}

export interface IHallSeat {
  id: number;
  label: string;
  rowLabel: string;
  number: number;
  gridRow: number;
  gridCol: number;
  width: number;
  type: SeatType;
  isActive: boolean;
}

export interface IHallDetail extends IHallListItem {
  seats: IHallSeat[];
}

export interface IHallRowSpec {
  rowLabel: string;
  type: SeatType;
  blocks: number[];
  wheelchairSeats?: number[];
  gapBefore?: boolean;
}

export interface IHallPreview {
  layoutRows: number;
  layoutCols: number;
  seatCount: number;
  seats: Omit<IHallSeat, "id" | "isActive">[];
}

export interface IAdminShowtime {
  id: number;
  movieId: number;
  movieTitle: string;
  hallId: number;
  hallName: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "cancelled";
  totalSeats: number;
  bookedSeats: number;
  prices: ISeatPrices;
  revenue: number;
  bookingCount: number;
  hasFullHallBooking: boolean;
  priceStandard: number;
  priceVip: number;
  priceCouple: number;
  fullHallPrice: number | null;
}
