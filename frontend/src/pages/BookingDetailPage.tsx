import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { LoadState, Notice } from "../components/common";
import { api, errorMessage } from "../lib/api";
import { formatDateTime, formatDay } from "../lib/dates";
import { formatMMK } from "../lib/money";
import type { IBooking } from "../lib/types";
import { useApi } from "../lib/useApi";

/**
 * A booking shown as a ticket, with a cancel option before the show.
 *
 * @returns The booking page.
 */
export function BookingDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const booking = useApi<IBooking>(`/bookings/${id}`);

  if (!booking.data) return <LoadState loading={booking.loading} error={booking.error} />;
  const b = booking.data;

  return (
    <section className="page narrow">
      <p>
        <Link to="/bookings" className="back">
          ← My bookings
        </Link>
      </p>
      {params.get("new") && b.status === "confirmed" && <Notice tone="ok">Booking confirmed. Show this code at the cinema counter.</Notice>}
      <Ticket booking={b} />
      {b.canCancel && <CancelBooking booking={b} onDone={booking.reload} />}
    </section>
  );
}

/**
 * Ticket card: code, movie, time, hall, seats and total.
 *
 * @param props - The booking.
 * @returns The ticket.
 */
export function Ticket({ booking: b }: { booking: IBooking }) {
  const cancelled = b.status === "cancelled";
  return (
    <article className={`ticket${cancelled ? " is-cancelled" : ""}`}>
      <div className="ticket-main">
        <p className="eyebrow">{b.isFullHall ? "Private screening" : "Admit " + b.seatCount}</p>
        <h1>{b.showtime.movieTitle}</h1>
        <dl className="ticket-facts">
          <div>
            <dt>When</dt>
            <dd>{formatDateTime(b.showtime.startsAt)}</dd>
          </div>
          <div>
            <dt>Hall</dt>
            <dd>{b.showtime.hallName}</dd>
          </div>
          <div className="wide">
            <dt>{b.isFullHall ? "Seats" : b.seatCount === 1 ? "Seat" : "Seats"}</dt>
            <dd>{b.isFullHall ? `Entire hall (${b.seatCount} seats)` : b.seats.map((s) => s.label).join(", ")}</dd>
          </div>
        </dl>
      </div>
      <div className="ticket-stub">
        <span className="eyebrow">Booking code</span>
        <span className="code">{b.bookingCode}</span>
        <span className="eyebrow">Total</span>
        <strong className="num">{formatMMK(b.totalPrice)}</strong>
        {cancelled && <span className="stamp">Cancelled {b.cancelledAt && formatDay(b.cancelledAt)}</span>}
        {b.showtime.status === "cancelled" && !cancelled && <span className="stamp">Showing cancelled</span>}
      </div>
    </article>
  );
}

/**
 * Cancel button with an inline confirmation step.
 *
 * @param props - The booking and a callback after cancelling.
 * @returns The cancel control.
 */
export function CancelBooking({ booking, onDone }: { booking: IBooking; onDone: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Cancels the booking.
   */
  async function cancel(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await api(`/bookings/${booking.id}`, { method: "DELETE" });
      await onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <div className="cancel-box">
      <Notice tone="error">{error}</Notice>
      {confirm ? (
        <div className="btn-row">
          <span>Cancel {booking.bookingCode} and free {booking.seatCount === 1 ? "the seat" : `all ${booking.seatCount} seats`}?</span>
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void cancel()}>
            {busy ? "Cancelling…" : "Yes, cancel"}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => setConfirm(false)}>
            Keep booking
          </button>
        </div>
      ) : (
        <button type="button" className="btn" onClick={() => setConfirm(true)}>
          Cancel booking
        </button>
      )}
    </div>
  );
}
