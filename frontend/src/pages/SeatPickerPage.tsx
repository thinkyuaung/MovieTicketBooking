import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { AgeBadge, LoadState, Notice } from "../components/common";
import { SEAT_TYPE_NAMES, SeatPlan } from "../components/SeatPlan";
import { api, ApiError, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatDateTime, formatTime } from "../lib/dates";
import { formatMMK } from "../lib/money";
import type { IBooking, IPlanSeat, IShowtimeSeatPlan } from "../lib/types";
import { useApi } from "../lib/useApi";

/** Must match the backend's MAX_SEATS_PER_BOOKING. */
const MAX_SEATS = 10;
/** How often the seat plan refreshes, so seats others take disappear. */
const REFRESH_MS = 5000;

/**
 * Reads a selection saved before the user was sent to log in.
 *
 * @param key - Storage key.
 * @returns Saved seat labels, or an empty list.
 */
function loadSaved(key: string): string[] {
  try {
    const saved = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return saved ? (JSON.parse(saved) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Seat picker for one showing: the cinema seat plan, a running total in MMK,
 * and the whole-hall option when the rules allow it.
 *
 * @returns The seat picker page.
 */
export function SeatPickerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const storageKey = `mt.pick.${id}`;
  const showing = useApi<IShowtimeSeatPlan>(`/showtimes/${id}/seats`);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(loadSaved(storageKey)));
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmHall, setConfirmHall] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Refresh the plan regularly.
  useEffect(() => {
    const timer = setInterval(() => void showing.reload(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [showing.reload]);

  // Drop selected seats that someone else has just taken.
  useEffect(() => {
    if (!showing.data) return;
    const free = new Set(showing.data.plan.seats.filter((s) => s.status === "available").map((s) => s.label));
    const lost = [...selectedRef.current].filter((l) => !free.has(l));
    if (lost.length) {
      setSelected((prev) => new Set([...prev].filter((l) => free.has(l))));
      setMessage({ tone: "error", text: `Sorry, ${lost.join(", ")} ${lost.length === 1 ? "was" : "were"} just taken by someone else.` });
    }
  }, [showing.data]);

  const seatsByLabel = useMemo(() => new Map(showing.data?.plan.seats.map((s) => [s.label, s]) ?? []), [showing.data]);
  const chosen = [...selected].map((l) => seatsByLabel.get(l)).filter((s): s is IPlanSeat => !!s);
  const total = chosen.reduce((sum, s) => sum + (s.price ?? 0), 0);

  if (!showing.data) return <LoadState loading={showing.loading} error={showing.error} />;
  const { showtime, plan } = showing.data;
  const started = new Date(showtime.startsAt).getTime() <= Date.now();
  const closed = showtime.status === "cancelled" || started;

  /**
   * Selects or unselects a seat, up to the booking limit.
   *
   * @param seat - The clicked seat.
   */
  function toggle(seat: IPlanSeat): void {
    setMessage(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(seat.label)) next.delete(seat.label);
      else if (next.size >= MAX_SEATS) {
        setMessage({ tone: "info", text: `You can book up to ${MAX_SEATS} seats at once. For a bigger group, book the whole hall.` });
      } else next.add(seat.label);
      return next;
    });
  }

  /**
   * Sends a guest to log in, keeping their selection for when they return.
   */
  function goToLogin(): void {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify([...selected]));
    } catch {
      // Storage blocked: the selection is lost, which is acceptable.
    }
    navigate(`/login?next=${encodeURIComponent(`/showtimes/${id}`)}`);
  }

  /**
   * Books the selected seats, or the whole hall.
   *
   * @param wholeHall - True to book every seat.
   */
  async function book(wholeHall: boolean): Promise<void> {
    if (!user) return goToLogin();
    setBusy(true);
    setMessage(null);
    try {
      const booking = wholeHall
        ? await api<IBooking>(`/showtimes/${id}/book-all`, { method: "POST" })
        : await api<IBooking>("/bookings", { method: "POST", body: { showtimeId: Number(id), seats: [...selected] } });
      navigate(`/bookings/${booking.id}?new=1`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.details && typeof err.details === "object" && "seats" in err.details) {
        const taken = (err.details as { seats: string[] }).seats;
        setSelected((prev) => new Set([...prev].filter((l) => !taken.includes(l))));
      }
      setMessage({ tone: "error", text: errorMessage(err) });
      setConfirmHall(false);
      await showing.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <p>
        <Link to={`/movies/${showtime.movie.id}`} className="back">
          ← {showtime.movie.title}
        </Link>
      </p>
      <div className="page-head">
        <div>
          <h1>Choose your seats</h1>
          <p className="meta">
            <strong>{showtime.movie.title}</strong> <AgeBadge rating={showtime.movie.ageRating} /> · {formatDateTime(showtime.startsAt)} ·{" "}
            {showtime.hall.name}
          </p>
        </div>
        <p className="muted small">
          {plan.counts.available} of {plan.counts.total} seats free
        </p>
      </div>

      {showtime.status === "cancelled" && <Notice tone="error">This showing has been cancelled.</Notice>}
      {showtime.status !== "cancelled" && started && <Notice tone="error">This showing has already started.</Notice>}

      <div className="picker">
        <div className="card picker-plan">
          <SeatPlan
            label={`Seat plan for ${showtime.hall.name}`}
            layoutRows={plan.layoutRows}
            layoutCols={plan.layoutCols}
            seats={plan.seats}
            selected={selected}
            onSeatClick={closed ? undefined : toggle}
          />
        </div>

        <aside className="card picker-summary" aria-live="polite">
          <h2>Your booking</h2>
          <p className="muted small">
            {showtime.movie.title} · {formatTime(showtime.startsAt)} · {showtime.hall.name}
          </p>
          {chosen.length === 0 ? (
            <p className="muted">Click seats on the plan to choose them.</p>
          ) : (
            <ul className="lines">
              {chosen.map((s) => (
                <li key={s.label}>
                  <span>
                    <strong>{s.label}</strong> <span className="muted small">{SEAT_TYPE_NAMES[s.type]}</span>
                  </span>
                  <span className="num">{formatMMK(s.price ?? 0)}</span>
                  <button type="button" className="link-btn" onClick={() => toggle(s)} aria-label={`Remove ${s.label}`}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="total">
            <span>Total</span>
            <strong className="num">{formatMMK(total)}</strong>
          </div>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <button type="button" className="btn btn-primary btn-block" disabled={closed || busy || chosen.length === 0} onClick={() => void book(false)}>
            {busy && !confirmHall ? "Booking…" : user ? `Book ${chosen.length || ""} seat${chosen.length === 1 ? "" : "s"}` : "Log in to book"}
          </button>

          {!closed && <WholeHall plan={showing.data} busy={busy} confirm={confirmHall} setConfirm={setConfirmHall} onBook={() => void book(true)} />}
        </aside>
      </div>
    </section>
  );
}

/**
 * The whole-hall option: a button when allowed, otherwise a short note saying why not.
 *
 * @param props - The seat plan, busy flag, confirm state and booking callback.
 * @returns The whole-hall panel.
 */
function WholeHall({
  plan,
  busy,
  confirm,
  setConfirm,
  onBook,
}: {
  plan: IShowtimeSeatPlan;
  busy: boolean;
  confirm: boolean;
  setConfirm: (v: boolean) => void;
  onBook: () => void;
}) {
  const { fullHall, counts } = plan.plan;
  return (
    <div className="whole-hall">
      <h3>Private screening</h3>
      {fullHall.eligible ? (
        confirm ? (
          <>
            <p>
              Book all {counts.total} seats in {plan.showtime.hall.name} for <strong>{formatMMK(fullHall.price)}</strong>?
            </p>
            <div className="btn-row">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={onBook}>
                {busy ? "Booking…" : "Confirm whole hall"}
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => setConfirm(false)}>
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted small">Book every seat for your group or event.</p>
            <button type="button" className="btn btn-block" onClick={() => setConfirm(true)}>
              Book entire hall · {formatMMK(fullHall.price)}
            </button>
          </>
        )
      ) : (
        <p className="muted small">{fullHall.reason}</p>
      )}
    </div>
  );
}
