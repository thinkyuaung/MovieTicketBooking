import { Link } from "react-router";
import { LoadState } from "../components/common";
import { formatDateTime } from "../lib/dates";
import { formatMMK } from "../lib/money";
import type { IBooking } from "../lib/types";
import { useApi } from "../lib/useApi";

/**
 * The logged-in user's bookings: upcoming first, then past and cancelled.
 *
 * @returns The my bookings page.
 */
export function MyBookingsPage() {
  const bookings = useApi<IBooking[]>("/bookings/me");
  const now = Date.now();
  const all = bookings.data ?? [];
  const upcoming = all
    .filter((b) => b.status === "confirmed" && b.showtime.status === "scheduled" && new Date(b.showtime.startsAt).getTime() > now)
    .sort((a, b) => a.showtime.startsAt.localeCompare(b.showtime.startsAt));
  const other = all.filter((b) => !upcoming.includes(b));

  return (
    <section className="page">
      <h1>My bookings</h1>
      <LoadState loading={bookings.loading && !bookings.data} error={bookings.error} />
      {bookings.data && all.length === 0 && (
        <p className="muted">
          You haven't booked anything yet. <Link to="/">Find a movie</Link>.
        </p>
      )}
      {upcoming.length > 0 && (
        <>
          <h2>Upcoming</h2>
          <BookingList bookings={upcoming} />
        </>
      )}
      {other.length > 0 && (
        <>
          <h2>Past and cancelled</h2>
          <BookingList bookings={other} />
        </>
      )}
    </section>
  );
}

/**
 * A list of booking rows linking to each ticket.
 *
 * @param props - Bookings to show.
 * @returns The list.
 */
function BookingList({ bookings }: { bookings: IBooking[] }) {
  return (
    <ul className="booking-list">
      {bookings.map((b) => {
        const state =
          b.status === "cancelled" ? "Cancelled" : b.showtime.status === "cancelled" ? "Showing cancelled" : b.canCancel ? "Confirmed" : "Watched";
        return (
          <li key={b.id}>
            <Link to={`/bookings/${b.id}`} className={`booking-row${b.status === "cancelled" ? " is-cancelled" : ""}`}>
              <span className="booking-title">
                <strong>{b.showtime.movieTitle}</strong>
                <span className="muted small">
                  {formatDateTime(b.showtime.startsAt)} · {b.showtime.hallName}
                </span>
              </span>
              <span className="small">{b.isFullHall ? `Entire hall` : b.seats.map((s) => s.label).join(", ")}</span>
              <span className="num">{formatMMK(b.totalPrice)}</span>
              <span className={`pill pill-${state === "Confirmed" ? "ok" : state === "Watched" ? "muted" : "bad"}`}>{state}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
