import { useState } from "react";
import { Link } from "react-router";
import { LoadState, Notice } from "../../components/common";
import { api, errorMessage, query } from "../../lib/api";
import { formatDateTime, formatDay, startOfDay } from "../../lib/dates";
import { formatMMK } from "../../lib/money";
import type { IAdminMovieStats, IDashboard } from "../../lib/types";
import { useApi } from "../../lib/useApi";

/**
 * Date range presets for the dashboard. `from` and `to` are day offsets from today.
 */
const RANGES = [
  { key: "next7", label: "Next 7 days", from: 0, to: 7 },
  { key: "next30", label: "Next 30 days", from: 0, to: 30 },
  { key: "last30", label: "Last 30 days", from: -30, to: 1 },
  { key: "all", label: "All time", from: null, to: null },
] as const;

/**
 * Compacts a kyat amount for chart axes and tiles, e.g. 1,250,000 → "1.25M".
 *
 * @param amount - Amount in MMK.
 * @returns The compact number.
 */
function compactMMK(amount: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount);
}

/**
 * Admin dashboard: revenue, bookings and how full the showings are, for a chosen period.
 *
 * @returns The dashboard page.
 */
export function DashboardPage() {
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]["key"]>("next7");
  const range = RANGES.find((r) => r.key === rangeKey)!;
  const path = `/admin/dashboard${query({
    from: range.from === null ? undefined : startOfDay(range.from),
    to: range.to === null ? undefined : startOfDay(range.to),
  })}`;
  const dash = useApi<IDashboard>(path);

  return (
    <section className="page">
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="segmented" role="radiogroup" aria-label="Period">
          {RANGES.map((r) => (
            <button key={r.key} type="button" role="radio" aria-checked={r.key === rangeKey} className={r.key === rangeKey ? "is-active" : ""} onClick={() => setRangeKey(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">Figures cover showings that start in this period. Reviews are all-time.</p>

      <LoadState loading={dash.loading && !dash.data} error={dash.error} />
      {dash.data && <DashboardBody data={dash.data} onChange={dash.reload} />}
    </section>
  );
}

/**
 * The dashboard's tiles, chart and tables.
 *
 * @param props - Dashboard data and a reload callback.
 * @returns The dashboard content.
 */
function DashboardBody({ data, onChange }: { data: IDashboard; onChange: () => Promise<void> }) {
  const t = data.totals;
  return (
    <>
      <div className="tiles">
        <div className="tile tile-hero">
          <span className="tile-label">Revenue</span>
          <span className="tile-value">{formatMMK(t.revenue)}</span>
          <span className="tile-sub">from {t.bookingCount} confirmed bookings</span>
        </div>
        <div className="tile">
          <span className="tile-label">Seats sold</span>
          <span className="tile-value">{t.bookedSeats.toLocaleString("en-US")}</span>
          <span className="tile-sub">of {t.totalSeats.toLocaleString("en-US")} · {t.occupancyRate}% full</span>
        </div>
        <div className="tile">
          <span className="tile-label">Showings</span>
          <span className="tile-value">{t.showtimeCount}</span>
          <span className="tile-sub">{t.movieCount} movies</span>
        </div>
        <div className="tile">
          <span className="tile-label">Whole-hall bookings</span>
          <span className="tile-value">{t.fullHallBookings}</span>
          <span className="tile-sub">private screenings</span>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card">
          <h2>Revenue by movie</h2>
          <RevenueChart movies={data.movies} />
        </section>
        <section className="card">
          <h2>Low reviews</h2>
          <LowReviews reviews={data.lowScoreReviews} onChange={onChange} />
        </section>
      </div>

      <section className="card">
        <h2>How full each showing is</h2>
        {data.showtimes.length === 0 ? (
          <p className="muted">No showings in this period.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Movie</th>
                  <th>Hall</th>
                  <th className="num">Seats sold</th>
                  <th>Full</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.showtimes.map((s) => (
                  <tr key={s.showtimeId} className={s.status === "cancelled" ? "is-cancelled" : ""}>
                    <td>
                      <Link to={`/admin/showtimes/${s.showtimeId}`}>{formatDateTime(s.startsAt)}</Link>
                    </td>
                    <td>{s.movieTitle}</td>
                    <td>{s.hallName}</td>
                    <td className="num">
                      {s.bookedSeats}/{s.totalSeats}
                    </td>
                    <td>
                      {s.status === "cancelled" ? (
                        <span className="pill pill-bad">Cancelled</span>
                      ) : s.isFullHall ? (
                        <span className="pill pill-accent">Whole hall</span>
                      ) : (
                        <Meter value={s.occupancyRate} />
                      )}
                    </td>
                    <td className="num">{formatMMK(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/**
 * Horizontal bar chart of revenue per movie, one hue, value at each bar's tip.
 * Hovering or focusing a row shows bookings, occupancy and showings.
 *
 * @param props - Per-movie stats, sorted by revenue.
 * @returns The chart.
 */
function RevenueChart({ movies }: { movies: IAdminMovieStats[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...movies.map((m) => m.revenue), 0);
  if (max === 0) return <p className="muted">No revenue in this period.</p>;

  return (
    <div className="barchart" role="table" aria-label="Revenue by movie in MMK">
      {movies.map((m) => {
        const pct = (m.revenue / max) * 100;
        return (
          <div
            key={m.movieId}
            className={`bar-row${active === m.movieId ? " is-active" : ""}`}
            role="row"
            tabIndex={0}
            onMouseEnter={() => setActive(m.movieId)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(m.movieId)}
            onBlur={() => setActive(null)}
          >
            <span className="bar-label" role="rowheader">
              {m.title}
            </span>
            <span className="bar-track" role="cell">
              <span className="bar" style={{ width: `${Math.max(pct, m.revenue > 0 ? 1 : 0)}%` }} />
              <span className="bar-value num">{compactMMK(m.revenue)}</span>
            </span>
            {active === m.movieId && (
              <span className="bar-tip" role="tooltip">
                <strong>{m.title}</strong>
                <span>{formatMMK(m.revenue)}</span>
                <span className="muted">
                  {m.bookedSeats}/{m.totalSeats} seats · {m.occupancyRate}% full · {m.showtimeCount} showings
                </span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Occupancy meter: one hue on a lighter track, with the percentage beside it.
 *
 * @param props - Percentage 0–100.
 * @returns The meter.
 */
function Meter({ value }: { value: number }) {
  return (
    <span className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={`${value}% full`}>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: `${Math.min(100, value)}%` }} />
      </span>
      <span className="num small">{Math.round(value)}%</span>
    </span>
  );
}

/**
 * Low-score reviews with a remove button for moderation.
 *
 * @param props - Reviews and a reload callback.
 * @returns The review list.
 */
function LowReviews({ reviews, onChange }: { reviews: IDashboard["lowScoreReviews"]; onChange: () => Promise<void> }) {
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (reviews.length === 0) return <p className="muted">No reviews scored 3 or lower.</p>;

  /**
   * Removes a review.
   *
   * @param id - Review id.
   */
  async function remove(id: number): Promise<void> {
    setError(null);
    try {
      await api(`/admin/reviews/${id}`, { method: "DELETE" });
      setConfirmId(null);
      await onChange();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <Notice tone="error">{error}</Notice>
      <ul className="reviews compact">
        {reviews.map((r) => (
          <li key={r.id} className="review">
            <div className="review-head">
              <strong>{r.userName}</strong>
              <span className="score">★ {r.score}/10</span>
              <span className="muted small">{formatDay(r.createdAt)}</span>
            </div>
            <p>{r.comment}</p>
            {confirmId === r.id ? (
              <div className="btn-row">
                <button type="button" className="btn btn-danger btn-small" onClick={() => void remove(r.id)}>
                  Remove review
                </button>
                <button type="button" className="btn btn-small" onClick={() => setConfirmId(null)}>
                  Keep
                </button>
              </div>
            ) : (
              <button type="button" className="link-btn small" onClick={() => setConfirmId(r.id)}>
                Remove…
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
