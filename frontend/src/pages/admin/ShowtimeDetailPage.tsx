import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { LoadState, Notice } from "../../components/common";
import { SeatPlan } from "../../components/SeatPlan";
import { api, errorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/dates";
import { formatMMK } from "../../lib/money";
import type { IAdminBooking, IAdminShowtime, IShowtimeSeatPlan } from "../../lib/types";
import { useApi } from "../../lib/useApi";
import { PriceFields, pricesBody, type IPriceForm } from "./ShowtimesAdminPage";

/**
 * One showing for admins: seat plan with who booked each seat, the booking
 * list, price changes, and cancelling or deleting the showing.
 *
 * @returns The showtime detail page.
 */
export function ShowtimeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showtime = useApi<IAdminShowtime>(`/admin/showtimes/${id}`);
  const plan = useApi<IShowtimeSeatPlan>(`/showtimes/${id}/seats`);
  const bookings = useApi<IAdminBooking[]>(`/admin/showtimes/${id}/bookings`);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);

  const bookedBy = useMemo(() => {
    const map = new Map<string, IAdminBooking>();
    for (const b of bookings.data ?? []) if (b.status === "confirmed") for (const s of b.seats) map.set(s.label, b);
    return map;
  }, [bookings.data]);

  /**
   * Reloads everything on the page.
   */
  async function reloadAll(): Promise<void> {
    await Promise.all([showtime.reload(), plan.reload(), bookings.reload()]);
  }

  /**
   * Cancels or deletes the showing.
   *
   * @param action - What to do.
   */
  async function act(action: "cancel" | "delete"): Promise<void> {
    setMessage(null);
    try {
      if (action === "delete") {
        await api(`/admin/showtimes/${id}`, { method: "DELETE" });
        navigate("/admin/showtimes");
        return;
      }
      const result = await api<{ cancelledBookings: number }>(`/admin/showtimes/${id}/cancel`, { method: "POST" });
      setMessage({ tone: "ok", text: `Showing cancelled. ${result.cancelledBookings} booking(s) were cancelled and their seats freed.` });
      await reloadAll();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setConfirm(null);
    }
  }

  /**
   * Cancels one customer's booking.
   *
   * @param booking - The booking.
   */
  async function cancelBooking(booking: IAdminBooking): Promise<void> {
    setMessage(null);
    try {
      await api(`/bookings/${booking.id}`, { method: "DELETE" });
      setMessage({ tone: "ok", text: `Booking ${booking.bookingCode} cancelled.` });
      await reloadAll();
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    }
  }

  if (!showtime.data) return <LoadState loading={showtime.loading} error={showtime.error} />;
  const s = showtime.data;
  const cancelled = s.status === "cancelled";
  const started = new Date(s.startsAt).getTime() <= Date.now();

  return (
    <section className="page">
      <p>
        <Link to="/admin/showtimes" className="back">
          ← Showtimes
        </Link>
      </p>
      <div className="page-head">
        <div>
          <h1>{s.movieTitle}</h1>
          <p className="meta">
            {formatDateTime(s.startsAt)} · {s.hallName}
            {cancelled && <span className="pill pill-bad">Cancelled</span>}
            {s.hasFullHallBooking && <span className="pill pill-accent">Whole hall</span>}
          </p>
        </div>
        <div className="kpis">
          <span>
            <strong>
              {s.bookedSeats}/{s.totalSeats}
            </strong>{" "}
            seats sold
          </span>
          <span>
            <strong>{formatMMK(s.revenue)}</strong> revenue
          </span>
        </div>
      </div>
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <div className="admin-show">
        <div className="card">
          <h2>Seat plan</h2>
          <LoadState loading={plan.loading && !plan.data} error={plan.error} />
          {plan.data && (
            <SeatPlan
              label={`Seat plan for ${s.hallName}`}
              layoutRows={plan.data.plan.layoutRows}
              layoutCols={plan.data.plan.layoutCols}
              seats={plan.data.plan.seats}
              describeSeat={(seat) => {
                const b = bookedBy.get(seat.label);
                return b ? `${b.customer.name} · ${b.bookingCode}` : null;
              }}
            />
          )}
        </div>

        <div className="stack">
          {!cancelled && <EditPrices showtime={s} onSaved={reloadAll} />}
          {!cancelled && (
            <div className="card">
              <h2>Showing</h2>
              {confirm ? (
                <div className="stack">
                  <p>
                    {confirm === "cancel"
                      ? `Cancel this showing? All ${s.bookingCount} confirmed booking(s) will be cancelled and customers will need refunds.`
                      : "Delete this showing permanently?"}
                  </p>
                  <div className="btn-row">
                    <button type="button" className="btn btn-danger" onClick={() => void act(confirm)}>
                      {confirm === "cancel" ? "Cancel showing" : "Delete showing"}
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirm(null)}>
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <div className="btn-row">
                  <button type="button" className="btn" onClick={() => setConfirm("cancel")}>
                    Cancel showing…
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setConfirm("delete")}
                    disabled={(bookings.data?.length ?? 0) > 0}
                    title={(bookings.data?.length ?? 0) > 0 ? "Showings with bookings can't be deleted; cancel instead" : undefined}
                  >
                    Delete…
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="card">
        <h2>Bookings</h2>
        <LoadState loading={bookings.loading && !bookings.data} error={bookings.error} />
        {bookings.data?.length === 0 && <p className="muted">No bookings yet.</p>}
        {bookings.data && bookings.data.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Customer</th>
                  <th>Seats</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {bookings.data.map((b) => (
                  <tr key={b.id} className={b.status === "cancelled" ? "is-cancelled" : ""}>
                    <td className="mono">{b.bookingCode}</td>
                    <td>
                      {b.customer.name}
                      <div className="muted small">
                        {b.customer.email}
                        {b.customer.phone && ` · ${b.customer.phone}`}
                      </div>
                    </td>
                    <td>{b.isFullHall ? `Whole hall (${b.seatCount})` : b.seats.map((x) => x.label).join(", ")}</td>
                    <td className="num">{formatMMK(b.totalPrice)}</td>
                    <td>
                      <span className={`pill ${b.status === "confirmed" ? "pill-ok" : "pill-bad"}`}>{b.status === "confirmed" ? "Confirmed" : "Cancelled"}</span>
                    </td>
                    <td className="actions">
                      {b.status === "confirmed" && !started && <CancelOne booking={b} onCancel={cancelBooking} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

/**
 * Cancel button for one booking, with an inline confirmation.
 *
 * @param props - The booking and the cancel action.
 * @returns The control.
 */
function CancelOne({ booking, onCancel }: { booking: IAdminBooking; onCancel: (b: IAdminBooking) => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <>
      <button type="button" className="btn btn-danger btn-small" onClick={() => void onCancel(booking)}>
        Cancel booking
      </button>
      <button type="button" className="btn btn-small" onClick={() => setConfirm(false)}>
        Keep
      </button>
    </>
  ) : (
    <button type="button" className="btn btn-small" onClick={() => setConfirm(true)}>
      Cancel…
    </button>
  );
}

/**
 * Form to change a showing's prices. New prices apply to new bookings only.
 *
 * @param props - The showing and a callback after saving.
 * @returns The form.
 */
function EditPrices({ showtime, onSaved }: { showtime: IAdminShowtime; onSaved: () => Promise<void> }) {
  const [prices, setPrices] = useState<IPriceForm>({
    priceStandard: String(showtime.priceStandard),
    priceVip: String(showtime.priceVip),
    priceCouple: String(showtime.priceCouple),
    fullHallPrice: showtime.fullHallPrice === null ? "" : String(showtime.fullHallPrice),
  });
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  /**
   * Saves the prices.
   *
   * @param e - Form submit event.
   */
  async function submit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      await api(`/admin/showtimes/${showtime.id}`, { method: "PATCH", body: pricesBody(prices) });
      setStatus({ tone: "ok", text: "Prices saved. They apply to new bookings." });
      await onSaved();
    } catch (err) {
      setStatus({ tone: "error", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2 className="span-all">Prices</h2>
      <PriceFields value={prices} onChange={setPrices} />
      {status && (
        <div className="span-all">
          <Notice tone={status.tone}>{status.text}</Notice>
        </div>
      )}
      <div className="span-all">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Saving…" : "Save prices"}
        </button>
      </div>
    </form>
  );
}
